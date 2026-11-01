import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { RateLimitService } from '../../common/rate-limit.service';
import {
  ConflictError, ForbiddenError, NotFoundError, UnprocessableError, ValidationDomainError,
} from '../../common/errors/domain-errors';
import { AppConfig } from '../../core/config/app.config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OutboxWriter } from '../../infrastructure/outbox/outbox-writer';
import type { Payment, Prisma } from '../../generated/prisma/client';
import { PayGatewayClient } from './pay-gateway.client';
import {
  PAYABLE_BOOKING_STATUSES, ServiceUnavailableError, decideTransition, toInternalStatus, type PaymentStatusValue,
} from './domain/payment-status';
import { signTicket } from './domain/payment-ticket';
import { sanitizeForAudit } from './domain/sanitize';
import { SIGNATURE_HEADER, verifySignature } from './domain/webhook-signature';

export { SIGNATURE_HEADER };

/** Une vérification de statut auprès du service de paiement au plus toutes les 10 s par paiement (SEC-08). */
const RECONCILE_MIN_INTERVAL_MS = 10_000;

/** Corps de la notification du service de paiement (voir docs/payments-integration.md). */
const webhookSchema = z.object({
  event_id: z.string().min(8).max(120),
  type: z.string().min(1).max(60).default('payment.updated'),
  data: z.object({
    payment_id: z.string().uuid(),
    reservation_id: z.string().uuid().optional(),
    status: z.string().min(1).max(40),
    amount: z.union([z.string(), z.number()]).optional(),
    currency: z.string().min(3).max(3).optional(),
    method: z.string().max(40).optional(),
    provider: z.string().max(60).optional(),
    provider_ref: z.string().max(120).optional(),
    card_brand: z.string().max(30).optional(),
    card_last4: z.string().regex(/^\d{4}$/).optional(),
    failure_reason: z.string().max(200).optional(),
  }),
});

/** Résultat annoncé par le service de paiement (webhook ou vérification de statut), dans une forme commune. */
interface IncomingResult {
  eventId: string;
  source: 'webhook' | 'poll';
  type: string;
  status: string;
  reservationId?: string;
  amount?: string | null;
  currency?: string | null;
  method?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  failureReason?: string | null;
  raw: unknown;
}

type ApplyOutcome = { kind: 'applied'; status: PaymentStatusValue; changed: boolean; anomaly: boolean } | { kind: 'duplicate' } | { kind: 'mismatch'; reason: string };

const toMethod = (value: string | null | undefined): 'VISA' | 'MOBILE_MONEY' | null => {
  const v = (value ?? '').toLowerCase();
  if (v === 'visa_stripe' || v === 'visa' || v === 'card') return 'VISA';
  if (v === 'mobile_money' || v === 'mobile-money') return 'MOBILE_MONEY';
  return null;
};

const money = (value: Prisma.Decimal | string | number) => Number(value).toFixed(2);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
    private readonly rateLimit: RateLimitService,
    private readonly outbox: OutboxWriter,
    private readonly gateway: PayGatewayClient,
  ) {}

  /** Vue renvoyée au client : références techniques seulement (marque + 4 derniers chiffres, jamais plus). */
  toResponse(p: Payment) {
    return {
      id: p.id,
      bookingId: p.bookingId,
      amount: { amount: money(p.amount), currency: p.currency },
      status: p.status,
      method: p.method,
      provider: p.provider,
      cardBrand: p.cardBrand,
      cardLast4: p.cardLast4,
      verifiedAt: p.verifiedAt,
      settledAt: p.settledAt,
      createdAt: p.createdAt,
    };
  }

  private requireEnabled(): { publicUrl: string } {
    const { enabled, publicUrl } = this.cfg.payments;
    if (!enabled || !publicUrl) throw new ServiceUnavailableError('PAYMENTS_UNAVAILABLE');
    return { publicUrl };
  }

  /**
   * Émet un ticket de paiement pour une réservation du demandeur.
   *  - SEC-04 : la réservation doit appartenir à l'utilisateur ;
   *  - SEC-03 : le montant vient de la réservation (Booking.totalAmount), jamais du client ;
   *  - SEC-07 : un paiement en cours est réutilisé (nouveau ticket, même paiement) ; un paiement réussi bloque toute nouvelle demande ;
   *  - SEC-08 : nombre d'émissions limité par utilisateur.
   */
  async createTicket(userId: string, bookingId: string) {
    const { publicUrl } = this.requireEnabled();
    await this.rateLimit.consume(`rl:pay:ticket:${userId}`, 10, 3600);

    const { payment, token, expiresAt } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookingId}))`;
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, requesterId: userId },
        select: {
          id: true, status: true, totalAmount: true, currency: true,
          requester: { select: { firstName: true, lastName: true, email: true } },
          tutorProfile: { select: { user: { select: { firstName: true, lastName: true } } } },
          offer: { select: { subject: { select: { name: true } } } },
        },
      });
      // Réservation inconnue OU d'un autre : même réponse, pour ne rien révéler.
      if (!booking) throw new ForbiddenError('PAYMENT_BOOKING_NOT_OWNED');
      if (!(PAYABLE_BOOKING_STATUSES as readonly string[]).includes(booking.status)) throw new UnprocessableError('PAYMENT_BOOKING_NOT_PAYABLE');
      if (Number(booking.totalAmount) <= 0) throw new UnprocessableError('PAYMENT_AMOUNT_UNAVAILABLE');

      const open = await tx.payment.findFirst({
        where: { bookingId, status: { in: ['PENDING', 'SUCCEEDED'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (open?.status === 'SUCCEEDED') throw new ConflictError('PAYMENT_ALREADY_SETTLED');

      const ttlSeconds = this.cfg.payments.ticketTtlMinutes * 60;
      const expires = new Date(Date.now() + ttlSeconds * 1000);
      const row = open
        ? await tx.payment.update({ where: { id: open.id }, data: { ticketExpiresAt: expires } })
        : await tx.payment.create({
            data: {
              bookingId, requesterId: userId, amount: booking.totalAmount, currency: booking.currency, ticketExpiresAt: expires,
            },
          });

      const tutor = booking.tutorProfile.user;
      const signed = signTicket(
        {
          sub: row.id,
          reservation_id: bookingId,
          amount: money(row.amount),
          currency: row.currency,
          customer_name: `${booking.requester.firstName} ${booking.requester.lastName}`.trim(),
          customer_email: booking.requester.email,
          description: `${booking.offer.subject.name} — ${tutor.firstName} ${tutor.lastName.slice(0, 1)}.`,
          return_url: `eduloc://payment/return?payment=${row.id}`,
          callback_url: `${this.cfg.apiUrl.replace(/\/$/, '')}/api/payments/webhook`,
        },
        { secret: this.cfg.payments.ticketSecret, ttlSeconds, jti: randomUUID() },
      );
      await tx.paymentEvent.create({
        data: {
          paymentId: row.id, eventId: `ticket:${signed.payload.jti}`, source: 'system', type: 'ticket.issued',
          fromStatus: row.status, toStatus: row.status, details: { expiresAt: expires.toISOString() },
        },
      });
      return { payment: row, token: signed.token, expiresAt: expires };
    });

    // Le ticket voyage dans le FRAGMENT de l'URL : il n'est jamais envoyé au serveur web ni écrit dans ses journaux.
    return { payment: this.toResponse(payment), checkoutUrl: `${publicUrl}/checkout#ticket=${token}`, expiresAt };
  }

  /** Statut d'un paiement. S'il est encore en cours, on interroge le service de paiement (notification manquée, MM-03). */
  async get(userId: string, paymentId: string) {
    let payment = await this.prisma.payment.findFirst({ where: { id: paymentId, requesterId: userId } });
    if (!payment) throw new NotFoundError('PAYMENT_NOT_FOUND');
    if (payment.status === 'PENDING') payment = (await this.reconcile(payment)) ?? payment;
    return this.toResponse(payment);
  }

  async listForBooking(userId: string, bookingId: string) {
    const rows = await this.prisma.payment.findMany({
      where: { bookingId, requesterId: userId }, orderBy: { createdAt: 'desc' }, take: 20,
    });
    return rows.map((p) => this.toResponse(p));
  }

  /** Interroge le service de paiement pour un paiement en cours ; renvoie le paiement relu, ou null si rien n'a pu être vérifié. */
  private async reconcile(payment: Payment): Promise<Payment | null> {
    if (!this.gateway.available) return null;
    const last = payment.verifiedAt ?? payment.createdAt;
    if (Date.now() - last.getTime() < RECONCILE_MIN_INTERVAL_MS) return null;
    try {
      await this.rateLimit.consume(`rl:pay:poll:${payment.id}`, 12, 60);
    } catch {
      return null; // trop d'interrogations : on garde le statut connu
    }
    const remote = await this.gateway.fetchStatus(payment.id);
    if (!remote) return null;
    await this.applyResult(payment.id, {
      eventId: `poll:${payment.id}:${remote.state}:${remote.verifiedAt ?? 'none'}`,
      source: 'poll',
      type: 'payment.status_polled',
      status: remote.state,
      amount: remote.verifiedAmount,
      currency: remote.currency,
      method: remote.method,
      provider: remote.provider,
      providerRef: remote.providerRef,
      cardBrand: remote.cardBrand,
      cardLast4: remote.cardLast4,
      raw: remote,
    }).catch((error: unknown) => {
      // Un écart de montant détecté à la vérification est journalisé ; l'utilisateur garde simplement le statut connu.
      this.logger.warn(`Vérification du paiement ${payment.id} non appliquée : ${error instanceof Error ? error.message : String(error)}`);
    });
    return this.prisma.payment.findUnique({ where: { id: payment.id } });
  }

  /**
   * Notification du service de paiement. Authentifiée par signature HMAC sur le corps BRUT (SEC-05) ; la page « paiement
   * réussi » affichée à l'utilisateur ne compte jamais comme preuve (SEC-06). Rejouable sans effet (SEC-07).
   */
  async handleWebhook(rawBody: string | undefined, signatureHeader: string | undefined) {
    this.requireEnabled();
    if (!rawBody) throw new ValidationDomainError('PAYMENT_EVENT_INVALID');
    const check = verifySignature(signatureHeader, rawBody, this.cfg.payments.webhookSecret);
    if (!check.ok) {
      this.logger.warn(`Notification de paiement rejetée (${check.reason}).`);
      throw new ForbiddenError('PAYMENT_SIGNATURE_INVALID');
    }

    let parsed: z.infer<typeof webhookSchema>;
    try {
      parsed = webhookSchema.parse(JSON.parse(rawBody));
    } catch {
      throw new ValidationDomainError('PAYMENT_EVENT_INVALID');
    }
    const { data } = parsed;
    const outcome = await this.applyResult(data.payment_id, {
      eventId: parsed.event_id,
      source: 'webhook',
      type: parsed.type,
      status: data.status,
      reservationId: data.reservation_id,
      amount: data.amount === undefined ? undefined : String(data.amount),
      currency: data.currency,
      method: data.method,
      provider: data.provider,
      providerRef: data.provider_ref,
      cardBrand: data.card_brand,
      cardLast4: data.card_last4,
      failureReason: data.failure_reason,
      raw: parsed,
    });
    // « applied » = le statut a réellement changé ; une notification déjà vue ou sans effet répond tout de même 200 (pas de nouvel essai).
    return { received: true, applied: outcome.kind === 'applied' && outcome.changed };
  }

  /** Applique un résultat annoncé par le service de paiement, après contrôle de cohérence (VISA-04, MM-03). */
  private async applyResult(paymentId: string, incoming: IncomingResult): Promise<ApplyOutcome> {
    const target = toInternalStatus(incoming.status);
    if (!target) throw new ValidationDomainError('PAYMENT_EVENT_INVALID');

    const outcome = await this.prisma.$transaction(async (tx): Promise<ApplyOutcome> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${paymentId}))`;
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundError('PAYMENT_NOT_FOUND');

      // Même notification reçue deux fois : aucun effet (SEC-07).
      const mismatchEventId = `anomaly:${incoming.eventId}`;
      const seen = await tx.paymentEvent.findFirst({
        where: { eventId: { in: [incoming.eventId, mismatchEventId] } }, select: { id: true },
      });
      if (seen) return { kind: 'duplicate' };

      const record = (eventId: string, toStatus: PaymentStatusValue, type: string, details: Record<string, unknown>) =>
        tx.paymentEvent.create({
          data: {
            paymentId, eventId, source: incoming.source, type, fromStatus: payment.status, toStatus,
            details: sanitizeForAudit({ ...details, reported: incoming.raw }) as Prisma.InputJsonObject,
          },
        });

      // Cohérence avec la réservation et le montant figé : sinon rien n'est validé (VISA-04, MM-03).
      const mismatch = this.findMismatch(payment, incoming, target);
      if (mismatch) {
        await record(mismatchEventId, payment.status, 'anomaly.mismatch', { reason: mismatch });
        return { kind: 'mismatch', reason: mismatch };
      }

      const { next, anomaly } = decideTransition(payment.status, target);
      const status = next ?? payment.status;
      const now = new Date();
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status,
          verifiedAt: now,
          settledAt: status === 'SUCCEEDED' ? payment.settledAt ?? now : undefined,
          method: toMethod(incoming.method) ?? undefined,
          provider: incoming.provider ?? undefined,
          providerRef: incoming.providerRef ?? undefined,
          cardBrand: incoming.cardBrand ?? undefined,
          cardLast4: incoming.cardLast4 ?? undefined,
          failureReason: status === 'FAILED' || status === 'CANCELLED' ? incoming.failureReason?.slice(0, 200) ?? undefined : undefined,
        },
      });
      await record(incoming.eventId, status, anomaly ? 'anomaly.late_status' : incoming.type, { applied: next !== null });

      if (next) {
        await this.outbox.write(tx, {
          aggregateType: 'payment',
          aggregateId: paymentId,
          eventType: 'payment.updated',
          recipientIds: [payment.requesterId],
          payload: { paymentId, bookingId: payment.bookingId, status: next },
          pushTitle: next === 'SUCCEEDED' ? 'Paiement confirmé' : next === 'FAILED' ? 'Paiement échoué' : null,
          pushBody: next === 'SUCCEEDED' ? 'Votre paiement a bien été reçu.' : next === 'FAILED' ? 'Votre paiement n’a pas abouti. Vous pouvez réessayer.' : null,
        });
      }
      return { kind: 'applied', status, changed: next !== null, anomaly };
    });

    if (outcome.kind === 'mismatch') {
      this.logger.error(`Paiement ${paymentId} : notification incohérente (${outcome.reason}) — à examiner.`);
      throw new UnprocessableError('PAYMENT_MISMATCH');
    }
    return outcome;
  }

  /** Raison de l'incohérence entre ce que le service annonce et ce qu'EduLoc a figé, ou null si tout concorde. */
  private findMismatch(payment: Payment, incoming: IncomingResult, target: PaymentStatusValue): string | null {
    if (incoming.reservationId && incoming.reservationId !== payment.bookingId) return 'reservation';
    if (incoming.currency && incoming.currency.toUpperCase() !== payment.currency) return 'currency';
    if (incoming.amount != null && incoming.amount !== '' && Number(incoming.amount).toFixed(2) !== money(payment.amount)) return 'amount';
    // Un succès sans montant ni devise confirmés n'est pas un succès vérifié.
    if (target === 'SUCCEEDED' && (incoming.amount == null || incoming.amount === '' || !incoming.currency)) return 'unverified_success';
    return null;
  }
}
