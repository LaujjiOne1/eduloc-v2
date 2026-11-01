import type { Config } from './config';
import type { EdulocEvent, NotifyResult } from './eduloc';
import { MobileMoneyError, type MobileMoneyStatus, normalizeMsisdn } from './mvola';
import { OdooError, type OdooPayment, type OdooUpsert, type PaymentState, type UpsertResult } from './odoo';
import { type Ticket, verifyTicket } from './security';
import { StripeError, type StripeIntent, cardOf, fromStripeAmount, toStripeAmount } from './stripe';

export class ServiceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

/** Ce dont le service a besoin du monde extérieur : tout est injectable, donc testable sans réseau. */
export interface Deps {
  cfg: Config;
  odoo: { upsert(payload: OdooUpsert): Promise<UpsertResult>; get(paymentId: string): Promise<OdooPayment | null> };
  stripe: {
    createIntent(args: { paymentId: string; reservationId: string; amount: number; currency: string; description: string }): Promise<StripeIntent>;
    retrieveIntent(id: string): Promise<StripeIntent>;
  } | null;
  mvola: {
    requestPayment(args: { amount: string; reference: string; description: string; payerMsisdn: string; callbackUrl: string | null }): Promise<{ correlationId: string }>;
    status(correlationId: string): Promise<MobileMoneyStatus>;
  } | null;
  notify(event: EdulocEvent, url: string): Promise<NotifyResult>;
  log?: (message: string) => void;
}

export interface SessionInfo {
  payment: { id: string; reservationId: string; amount: string; currency: string; description: string; customerName: string; returnUrl: string };
  state: PaymentState;
  methods: { visa: { publishableKey: string } | null; mobileMoney: string[] };
}

const OPERATORS = ['mvola'] as const;
const RETURN_PREFIX = 'eduloc://payment/return';

/**
 * Cœur du service de paiement. Sans base de données : chaque paiement vit dans le CRM Odoo, et chaque statut vient du prestataire.
 *
 *  - le MONTANT vient toujours du ticket signé par EduLoc, jamais du navigateur (SEC-03) ;
 *  - un paiement n'est « réussi » qu'après relecture auprès du prestataire ET concordance du montant et de la devise avec ce
 *    qu'Odoo a enregistré à l'ouverture (VISA-04, MM-03) ;
 *  - authentification 3-D Secure réussie ≠ paiement : seul le résultat financier du PaymentIntent compte ;
 *  - une demande Mobile Money acceptée (202) reste « en cours » (MM-02) ; aucun PIN ne passe ici (MM-01).
 */
export class PaymentService {
  constructor(private readonly deps: Deps) {}

  private log(message: string) {
    this.deps.log?.(message);
  }

  /** Ticket vérifié ou erreur 401. */
  private verified(token: unknown): Ticket {
    const ticket = verifyTicket(token, this.deps.cfg.ticketSecret);
    if (!ticket) throw new ServiceError(401, 'ticket_invalid', 'Ticket invalide ou expiré. Retournez dans l’application et relancez le paiement.');
    if (!ticket.return_url.startsWith(RETURN_PREFIX)) throw new ServiceError(401, 'ticket_invalid', 'Ticket invalide.');
    return ticket;
  }

  private async record(ticket: Ticket): Promise<OdooPayment> {
    const existing = await this.deps.odoo.get(ticket.sub);
    if (existing) {
      // Le ticket et le paiement enregistré doivent raconter la même histoire (montant figé à l'ouverture).
      if (
        existing.reservation_id !== ticket.reservation_id ||
        existing.currency !== ticket.currency ||
        Math.abs(Number(existing.amount) - Number(ticket.amount)) > 0.005
      ) {
        throw new ServiceError(409, 'ticket_mismatch', 'Ce ticket ne correspond pas au paiement enregistré.');
      }
      return existing;
    }
    const created = await this.deps.odoo.upsert({
      event_id: `opened:${ticket.sub}`,
      payment_id: ticket.sub,
      reservation_id: ticket.reservation_id,
      status: 'PENDING',
      amount: Number(ticket.amount).toFixed(2),
      currency: ticket.currency,
      customer_name: ticket.customer_name,
      customer_email: ticket.customer_email,
      description: ticket.description,
      source: 'pay-service',
    });
    if (created.status === 'rejected' || !created.payment) throw new ServiceError(409, 'ticket_mismatch', 'Ce ticket ne correspond pas au paiement enregistré.');
    return created.payment;
  }

  /** Ouverture de la page de paiement : ce qu'il faut afficher (montant FIGÉ, libellé) et les moyens réellement disponibles. */
  async openSession(token: unknown): Promise<SessionInfo> {
    const ticket = this.verified(token);
    const record = await this.record(ticket);
    return {
      payment: {
        id: ticket.sub,
        reservationId: ticket.reservation_id,
        amount: record.amount,
        currency: record.currency,
        description: ticket.description,
        customerName: ticket.customer_name,
        returnUrl: ticket.return_url,
      },
      state: record.state,
      methods: {
        visa: this.deps.stripe ? { publishableKey: this.deps.cfg.stripe!.publishableKey } : null,
        mobileMoney: this.deps.mvola ? [...OPERATORS] : [],
      },
    };
  }

  // ------------------------------------------------------------------ Visa / carte (Stripe)
  async startCard(token: unknown): Promise<{ alreadyPaid: true } | { clientSecret: string; publishableKey: string }> {
    const ticket = this.verified(token);
    if (!this.deps.stripe) throw new ServiceError(503, 'method_unavailable', 'Le paiement par carte n’est pas disponible.');
    const record = await this.record(ticket);
    if (record.state === 'SUCCEEDED') return { alreadyPaid: true };
    if (record.state !== 'PENDING') throw new ServiceError(409, 'payment_closed', 'Ce paiement est clos. Relancez-le depuis l’application.');

    let intent: StripeIntent;
    try {
      intent = await this.deps.stripe.createIntent({
        paymentId: ticket.sub,
        reservationId: ticket.reservation_id,
        amount: toStripeAmount(record.amount, record.currency),
        currency: record.currency,
        description: ticket.description,
      });
    } catch (error) {
      throw this.provider(error);
    }
    if (intent.status === 'succeeded') {
      await this.syncIntent(ticket.sub, intent.id, ticket.callback_url);
      return { alreadyPaid: true };
    }
    if (intent.status === 'canceled') throw new ServiceError(409, 'payment_closed', 'Ce paiement est clos. Relancez-le depuis l’application.');

    await this.deps.odoo.upsert({
      event_id: `pi:${intent.id}`, payment_id: ticket.sub, status: 'PENDING', method: 'visa_stripe', provider: 'stripe',
      provider_ref: intent.id, source: 'pay-service',
    });
    return { clientSecret: intent.client_secret ?? '', publishableKey: this.deps.cfg.stripe!.publishableKey };
  }

  /**
   * Relit le PaymentIntent chez Stripe et enregistre le résultat. Appelé par le webhook Stripe ET par la consultation de statut :
   * on ne se fie jamais au corps d'une notification, seulement à ce que Stripe répond maintenant (VISA-04).
   */
  async syncIntent(paymentId: string, intentId: string, callbackUrl?: string): Promise<OdooPayment | null> {
    if (!this.deps.stripe) return null;
    let intent: StripeIntent;
    try {
      intent = await this.deps.stripe.retrieveIntent(intentId);
    } catch (error) {
      throw this.provider(error);
    }
    const record = await this.deps.odoo.get(paymentId);
    if (!record) {
      this.log(`syncIntent : paiement ${paymentId} inconnu dans Odoo (PaymentIntent ${intent.id}).`);
      return null;
    }
    if (intent.metadata?.payment_id !== paymentId) {
      this.log(`syncIntent : le PaymentIntent ${intent.id} n'appartient pas au paiement ${paymentId}.`);
      return record;
    }

    // Statuts Stripe → internes. Un refus de carte n'est PAS final (le client peut réessayer avec une autre) : il reste « en cours ».
    const state: PaymentState = intent.status === 'succeeded' ? 'SUCCEEDED' : intent.status === 'canceled' ? 'CANCELLED' : 'PENDING';
    const expected = toStripeAmount(record.amount, record.currency);
    if (state === 'SUCCEEDED' && (intent.amount_received !== expected || intent.currency.toUpperCase() !== record.currency)) {
      // Succès annoncé avec un autre montant ou une autre devise : on le consigne tel quel, Odoo le refusera et signalera l'anomalie.
      this.log(`syncIntent : montant/devise incohérents pour ${paymentId} (reçu ${intent.amount_received} ${intent.currency}).`);
    }
    const card = cardOf(intent);
    const result = await this.deps.odoo.upsert({
      event_id: `stripe:${intent.id}:${state}`,
      payment_id: paymentId,
      status: state,
      amount: fromStripeAmount(state === 'SUCCEEDED' ? intent.amount_received : intent.amount, intent.currency),
      currency: intent.currency.toUpperCase(),
      method: 'visa_stripe',
      provider: 'stripe',
      provider_ref: intent.id,
      card_brand: card.brand,
      card_last4: card.last4,
      failure_reason: intent.last_payment_error?.message?.slice(0, 200),
      source: 'stripe',
    });
    if (result.status !== 'rejected' && state !== 'PENDING' && result.status !== 'duplicate' && result.status !== 'unchanged') {
      await this.tell(record, result.payment, callbackUrl);
    }
    return result.payment ?? record;
  }

  // ------------------------------------------------------------------ Mobile Money (MVola)
  async startMobileMoney(token: unknown, operator: unknown, phone: unknown): Promise<{ state: PaymentState } | { alreadyPaid: true }> {
    const ticket = this.verified(token);
    if (!this.deps.mvola || operator !== 'mvola') throw new ServiceError(503, 'method_unavailable', 'Cet opérateur n’est pas disponible.');
    const msisdn = typeof phone === 'string' ? normalizeMsisdn(phone) : null;
    if (!msisdn) throw new ServiceError(422, 'invalid_phone', 'Numéro de téléphone invalide (ex. 034 12 345 67).');
    const record = await this.record(ticket);
    if (record.state === 'SUCCEEDED') return { alreadyPaid: true };
    if (record.state !== 'PENDING') throw new ServiceError(409, 'payment_closed', 'Ce paiement est clos. Relancez-le depuis l’application.');
    // Une demande est déjà partie vers un téléphone : on ne la double pas (pas de second push USSD).
    if (record.method === 'mobile_money' && record.operator_ref) return { state: 'PENDING' };

    const callbackUrl = this.deps.cfg.publicUrl ? `${this.deps.cfg.publicUrl}/api/v1/mobile-money/mvola/callback/${ticket.sub}` : null;
    let correlationId: string;
    try {
      ({ correlationId } = await this.deps.mvola.requestPayment({
        amount: record.amount, reference: ticket.sub, description: ticket.description, payerMsisdn: msisdn, callbackUrl,
      }));
    } catch (error) {
      throw this.provider(error);
    }
    // Le numéro n'est PAS conservé : seul le suivi opérateur l'est (confidentialité et MM-01).
    await this.deps.odoo.upsert({
      event_id: `mvola:init:${correlationId}`, payment_id: ticket.sub, status: 'PENDING', method: 'mobile_money', provider: 'mvola',
      operator_ref: correlationId, source: 'pay-service',
    });
    return { state: 'PENDING' };
  }

  /** Interroge MVola (source de vérité) pour un paiement en cours et enregistre le résultat. */
  async refreshMobileMoney(paymentId: string, callbackUrl?: string): Promise<OdooPayment | null> {
    const record = await this.deps.odoo.get(paymentId);
    if (!record || record.state !== 'PENDING' || record.method !== 'mobile_money' || !record.operator_ref || !this.deps.mvola) return record;
    let status: MobileMoneyStatus;
    try {
      status = await this.deps.mvola.status(record.operator_ref);
    } catch (error) {
      throw this.provider(error);
    }
    if (status.state === 'PENDING') return record;
    const result = await this.deps.odoo.upsert({
      event_id: `mvola:${record.operator_ref}:${status.state}`,
      payment_id: paymentId,
      status: status.state,
      amount: status.state === 'SUCCEEDED' ? status.verifiedAmount ?? undefined : undefined,
      currency: status.state === 'SUCCEEDED' ? status.currency ?? undefined : undefined,
      method: 'mobile_money',
      provider: 'mvola',
      provider_ref: status.transactionRef ?? undefined,
      failure_reason: status.state === 'FAILED' ? 'refusé ou expiré chez l’opérateur' : undefined,
      source: 'mvola',
    });
    if (result.status !== 'rejected' && result.status !== 'duplicate' && result.status !== 'unchanged') {
      await this.tell(record, result.payment, callbackUrl);
    }
    return result.payment ?? record;
  }

  // ------------------------------------------------------------------ Statut
  /** Statut d'un paiement, rafraîchi auprès du prestataire s'il est encore en cours. null = inconnu. */
  async status(paymentId: string, callbackUrl?: string): Promise<OdooPayment | null> {
    let record = await this.deps.odoo.get(paymentId);
    if (record?.state === 'PENDING') {
      try {
        if (record.method === 'visa_stripe' && record.provider_ref) record = (await this.syncIntent(paymentId, record.provider_ref, callbackUrl)) ?? record;
        else if (record.method === 'mobile_money') record = (await this.refreshMobileMoney(paymentId, callbackUrl)) ?? record;
      } catch (error) {
        // Prestataire injoignable : le statut connu reste valable, jamais un échec (MM-02).
        this.log(`status : actualisation impossible pour ${paymentId} (${error instanceof Error ? error.message : String(error)}).`);
      }
    }
    return record;
  }

  /** Statut à partir d'un ticket (la page de paiement n'a pas d'autre moyen de s'identifier). */
  async statusForTicket(token: unknown): Promise<OdooPayment | null> {
    const ticket = this.verified(token);
    return this.status(ticket.sub, ticket.callback_url);
  }

  // ------------------------------------------------------------------ Notification d'EduLoc
  /** Prévient le backend EduLoc d'un résultat FINAL, signé (voir eduloc.ts). Ne lève jamais : le statut reste lisible dans Odoo. */
  private async tell(before: OdooPayment, after: OdooPayment | null, ticketCallback?: string): Promise<void> {
    const payment = after ?? before;
    if (payment.state === 'PENDING') return;
    const url = this.deps.cfg.edulocWebhookUrl ?? ticketCallback;
    if (!url) {
      this.log(`Aucune adresse de notification EduLoc pour ${payment.payment_id} : EduLoc relira le statut.`);
      return;
    }
    const event: EdulocEvent = {
      event_id: `pay:${payment.payment_id}:${payment.state}:${payment.provider_ref ?? 'none'}`,
      type: 'payment.updated',
      data: {
        payment_id: payment.payment_id,
        reservation_id: payment.reservation_id,
        status: payment.state,
        // Montant et devise CONSTATÉS : EduLoc les recontrôle contre le ticket avant de valider (VISA-04).
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method ?? undefined,
        provider: payment.provider ?? undefined,
        provider_ref: payment.provider_ref ?? undefined,
        card_brand: payment.card_brand ?? undefined,
        card_last4: payment.card_last4 ?? undefined,
      },
    };
    const outcome = await this.deps.notify(event, url);
    if (!outcome.ok) this.log(`Notification EduLoc non acquittée pour ${payment.payment_id} (HTTP ${outcome.status}, ${outcome.attempts} essais).`);
  }

  private provider(error: unknown): ServiceError {
    if (error instanceof ServiceError) return error;
    if (error instanceof StripeError || error instanceof MobileMoneyError || error instanceof OdooError) {
      this.log(error.message);
      return new ServiceError(502, 'provider_error', 'Le service de paiement est momentanément indisponible. Réessayez dans un instant.');
    }
    return new ServiceError(500, 'internal_error', 'Erreur interne.');
  }
}
