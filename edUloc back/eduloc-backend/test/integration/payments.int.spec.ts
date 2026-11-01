/**
 * Paiements (ticket, notification signée, statuts) : base PostgreSQL RÉELLE, migrations appliquées. À lancer avec :
 *
 *   TEST_DATABASE_URL=postgresql://eduloc:eduloc@localhost:5433/eduloc_pay_test npm run test:int
 *
 * Ne jamais pointer vers la base de développement ni Supabase. Chaque exécution crée ses données et les supprime.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/core/prisma/prisma.service';
import type { AppConfig } from '../../src/core/config/app.config';
import { OutboxWriter } from '../../src/infrastructure/outbox/outbox-writer';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { verifyTicket } from '../../src/modules/payments/domain/payment-ticket';
import { buildSignatureHeader } from '../../src/modules/payments/domain/webhook-signature';

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'TEST_DATABASE_URL absent : tests d’intégration ignorés';

const run = randomUUID().slice(0, 8);
const pool = new pg.Pool({ connectionString: url, max: 4 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const db = prisma as unknown as PrismaService;

const TICKET_SECRET = 'ticket-secret-ticket-secret-ticket-0123456789';
const WEBHOOK_SECRET = 'webhook-secret-webhook-secret-webhook-012345';
const config = (enabled: boolean) => ({
  apiUrl: 'https://api.eduloc.test',
  payments: {
    enabled, publicUrl: 'https://pay.eduloc.test', apiUrl: null, apiKey: '', ticketSecret: TICKET_SECRET,
    webhookSecret: WEBHOOK_SECRET, ticketTtlMinutes: 20,
  },
}) as unknown as AppConfig;
const rateLimit = { consume: async () => undefined } as never;
const gateway = { available: false, fetchStatus: async () => null } as never;
const service = new PaymentsService(db, config(true), rateLimit, new OutboxWriter(), gateway);
const disabledService = new PaymentsService(db, config(false), rateLimit, new OutboxWriter(), gateway);

const createdUsers: string[] = [];
const createdSubjects: string[] = [];
const code = (promise: Promise<unknown>) => promise.then(() => 'OK', (e: { message?: string }) => e.message ?? 'ERR');

const makeUser = async () => {
  const user = await prisma.user.create({
    data: {
      firstName: 'Test', lastName: `Pay-${run}`, email: `pay-${run}-${randomUUID().slice(0, 6)}@example.mg`,
      password: 'x', status: 'ACTIVE', emailVerified: true,
    },
  });
  createdUsers.push(user.id);
  return user;
};

/** Notification du service de paiement, correctement signée. */
const webhook = (paymentId: string, bookingId: string, data: Record<string, unknown>, eventId = `evt_${randomUUID()}`) => {
  const body = JSON.stringify({ event_id: eventId, type: 'payment.updated', data: { payment_id: paymentId, reservation_id: bookingId, ...data } });
  return { body, header: buildSignatureHeader(WEBHOOK_SECRET, body), eventId };
};

describe('paiements (base réelle)', { skip }, () => {
  let requesterId: string;
  let strangerId: string;
  let bookingId: string;
  let pendingBookingId: string;
  let profileId: string;

  before(async () => {
    requesterId = (await makeUser()).id;
    strangerId = (await makeUser()).id;
    const tutor = await makeUser();
    profileId = (await prisma.tutorProfile.create({ data: { userId: tutor.id, displayName: `Tuteur ${run}`, isVisible: true } })).id;
    const subject = await prisma.subject.create({ data: { name: `Matière ${run}` } });
    createdSubjects.push(subject.id);
    const offer = await prisma.offer.create({
      data: { tutorProfileId: profileId, subjectId: subject.id, title: 'Cours', description: 'd', price: 40000 },
    });
    const beneficiary = await prisma.beneficiary.create({ data: { requesterId, firstName: 'Élève', relationship: 'SELF' } });
    const base = {
      requesterId, beneficiaryId: beneficiary.id, tutorProfileId: profileId, offerId: offer.id, teachingMode: 'ONLINE' as const,
      price: 40000, totalAmount: 47000, offerTitle: 'Cours',
    };
    const day = 86_400_000;
    bookingId = (await prisma.booking.create({
      data: { ...base, startAt: new Date(Date.now() + 2 * day), endAt: new Date(Date.now() + 2 * day + 3_600_000), status: 'CONFIRMED' },
    })).id;
    pendingBookingId = (await prisma.booking.create({
      data: { ...base, startAt: new Date(Date.now() + 3 * day), endAt: new Date(Date.now() + 3 * day + 3_600_000), status: 'PENDING' },
    })).id;
  });

  after(async () => {
    await prisma.payment.deleteMany({ where: { requesterId } });
    await prisma.booking.deleteMany({ where: { tutorProfileId: profileId } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.subject.deleteMany({ where: { id: { in: createdSubjects } } });
    await prisma.$disconnect();
    await pool.end();
  });

  it('refuse d’émettre un ticket quand le service de paiement est désactivé', async () => {
    assert.equal(await code(disabledService.createTicket(requesterId, bookingId)), 'PAYMENTS_UNAVAILABLE');
  });

  it('refuse la réservation d’un autre utilisateur et une réservation pas encore confirmée (SEC-04)', async () => {
    assert.equal(await code(service.createTicket(strangerId, bookingId)), 'PAYMENT_BOOKING_NOT_OWNED');
    assert.equal(await code(service.createTicket(requesterId, randomUUID())), 'PAYMENT_BOOKING_NOT_OWNED');
    assert.equal(await code(service.createTicket(requesterId, pendingBookingId)), 'PAYMENT_BOOKING_NOT_PAYABLE');
  });

  let paymentId: string;

  it('émet un ticket signé dont le montant vient de la réservation, et le réutilise au deuxième appel (SEC-03, SEC-07)', async () => {
    const first = await service.createTicket(requesterId, bookingId);
    paymentId = first.payment.id;
    assert.equal(first.payment.status, 'PENDING');
    assert.deepEqual(first.payment.amount, { amount: '47000.00', currency: 'MGA' });
    const [origin, fragment] = first.checkoutUrl.split('#');
    assert.equal(origin, 'https://pay.eduloc.test/checkout');
    const claims = verifyTicket(fragment.replace('ticket=', ''), TICKET_SECRET);
    assert.ok(claims, 'le ticket doit être valide');
    assert.equal(claims.amount, '47000.00');
    assert.equal(claims.sub, paymentId);
    assert.equal(claims.reservation_id, bookingId);
    assert.equal(claims.callback_url, 'https://api.eduloc.test/api/payments/webhook');

    const second = await service.createTicket(requesterId, bookingId);
    assert.equal(second.payment.id, paymentId, 'un paiement en cours est réutilisé, pas dupliqué');
    assert.equal(await prisma.payment.count({ where: { bookingId } }), 1);
  });

  it('rejette une notification sans signature valide (SEC-05)', async () => {
    const { body } = webhook(paymentId, bookingId, { status: 'SUCCEEDED', amount: '47000.00', currency: 'MGA' });
    assert.equal(await code(service.handleWebhook(body, undefined)), 'PAYMENT_SIGNATURE_INVALID');
    assert.equal(await code(service.handleWebhook(body, 't=1,v1=' + '0'.repeat(64))), 'PAYMENT_SIGNATURE_INVALID');
    assert.equal(await code(service.handleWebhook(body.replace('47000', '1'), buildSignatureHeader(WEBHOOK_SECRET, body))), 'PAYMENT_SIGNATURE_INVALID');
  });

  it('ne valide pas un succès dont le montant ne correspond pas, et journalise l’anomalie (VISA-04, MM-03)', async () => {
    const bad = webhook(paymentId, bookingId, { status: 'SUCCEEDED', amount: '1000.00', currency: 'MGA' });
    assert.equal(await code(service.handleWebhook(bad.body, bad.header)), 'PAYMENT_MISMATCH');
    const noAmount = webhook(paymentId, bookingId, { status: 'SUCCEEDED' });
    assert.equal(await code(service.handleWebhook(noAmount.body, noAmount.header)), 'PAYMENT_MISMATCH');
    const wrongBooking = webhook(paymentId, randomUUID(), { status: 'SUCCEEDED', amount: '47000.00', currency: 'MGA' });
    assert.equal(await code(service.handleWebhook(wrongBooking.body, wrongBooking.header)), 'PAYMENT_MISMATCH');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assert.equal(payment.status, 'PENDING', 'rien n’est validé sur une notification incohérente');
    assert.equal(await prisma.paymentEvent.count({ where: { paymentId, type: 'anomaly.mismatch' } }), 3);
  });

  it('un résultat intermédiaire (3-D Secure, demande acceptée) laisse le paiement en cours (MM-02)', async () => {
    const evt = webhook(paymentId, bookingId, { status: 'REQUIRES_ACTION' });
    await service.handleWebhook(evt.body, evt.header);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status, 'PENDING');
  });

  it('confirme le paiement sur un succès vérifié, sans jamais stocker de donnée de carte (VISA-02)', async () => {
    const evt = webhook(paymentId, bookingId, {
      status: 'SUCCEEDED', amount: '47000.00', currency: 'MGA', method: 'visa_stripe', provider: 'stripe', provider_ref: 'pi_123',
      card_brand: 'visa', card_last4: '4242', cvv: '123', card_number: '4242424242424242',
    });
    assert.deepEqual(await service.handleWebhook(evt.body, evt.header), { received: true, applied: true });

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assert.equal(payment.status, 'SUCCEEDED');
    assert.equal(payment.method, 'VISA');
    assert.equal(payment.cardLast4, '4242');
    assert.ok(payment.settledAt);

    const event = await prisma.paymentEvent.findUniqueOrThrow({ where: { eventId: evt.eventId } });
    const journal = JSON.stringify(event.details);
    assert.doesNotMatch(journal, /4242424242424242|"123"/, 'ni CVV ni numéro complet dans le journal');

    assert.equal(await prisma.outboxEvent.count({ where: { aggregateId: paymentId, eventType: 'payment.updated' } }) >= 1, true);
  });

  it('une notification rejouée n’a aucun effet (SEC-07)', async () => {
    const evt = webhook(paymentId, bookingId, { status: 'SUCCEEDED', amount: '47000.00', currency: 'MGA' }, 'evt_replay_00000001');
    assert.equal((await service.handleWebhook(evt.body, evt.header)).applied, false);
    assert.equal((await service.handleWebhook(evt.body, evt.header)).applied, false);
    assert.equal(await prisma.paymentEvent.count({ where: { eventId: 'evt_replay_00000001' } }), 1);
  });

  it('un échec tardif ne défait pas un paiement réussi, et une nouvelle demande est refusée', async () => {
    const evt = webhook(paymentId, bookingId, { status: 'FAILED', failure_reason: 'timeout' });
    assert.equal((await service.handleWebhook(evt.body, evt.header)).applied, false);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status, 'SUCCEEDED');
    assert.equal(await prisma.paymentEvent.count({ where: { paymentId, type: 'anomaly.late_status' } }), 1);
    assert.equal(await code(service.createTicket(requesterId, bookingId)), 'PAYMENT_ALREADY_SETTLED');
  });

  it('seul le demandeur lit le statut de son paiement', async () => {
    assert.equal((await service.get(requesterId, paymentId)).status, 'SUCCEEDED');
    assert.equal(await code(service.get(strangerId, paymentId)), 'PAYMENT_NOT_FOUND');
    assert.equal((await service.listForBooking(requesterId, bookingId)).length, 1);
    assert.equal((await service.listForBooking(strangerId, bookingId)).length, 0);
  });
});
