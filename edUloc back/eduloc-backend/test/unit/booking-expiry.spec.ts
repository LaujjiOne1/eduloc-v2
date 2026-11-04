import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { BookingExpiryQueue, bullConnection } from '../../src/modules/bookings/booking-expiry.queue';
import { deadlineFrom } from '../../src/modules/bookings/domain/deadlines';
import { BookingStateMachine } from '../../src/modules/bookings/domain/booking-state-machine';

describe('expiration des demandes en attente', () => {
  it('un identifiant de job unique par demande, sans « : » (interdit par BullMQ)', () => {
    const id = BookingExpiryQueue.jobId('abc-123');
    assert.equal(id, 'booking-abc-123-expire');
    assert.ok(!id.includes(':'));
  });

  it('le délai de paiement a son propre job, distinct de celui de la demande', () => {
    assert.equal(BookingExpiryQueue.paymentJobId('abc-123'), 'booking-abc-123-payment-expire');
    assert.notEqual(BookingExpiryQueue.paymentJobId('abc'), BookingExpiryQueue.jobId('abc'));
  });

  it('l\'échéance est « maintenant + durée choisie », jamais après le début du cours', () => {
    const now = new Date('2026-11-02T08:00:00Z');
    const startAt = new Date('2026-11-02T20:00:00Z');
    assert.equal(deadlineFrom(now, 360, startAt).toISOString(), '2026-11-02T14:00:00.000Z');
    assert.equal(deadlineFrom(now, 1440, startAt).toISOString(), startAt.toISOString());
  });

  it('une réservation confirmée peut être annulée par le système, pas une séance en cours', () => {
    assert.doesNotThrow(() => BookingStateMachine.assertCanTransition('CONFIRMED', 'CANCELLED', 'SYSTEM'));
    assert.throws(() => BookingStateMachine.assertCanTransition('IN_PROGRESS', 'CANCELLED', 'SYSTEM'));
  });

  it('lit l\'URL Redis (hôte, port, mot de passe, base, TLS) et ne limite pas les tentatives du worker', () => {
    assert.deepEqual(bullConnection('redis://localhost:6379'), {
      host: 'localhost', port: 6379, username: undefined, password: undefined, db: undefined, maxRetriesPerRequest: null,
    });
    const secured = bullConnection('rediss://user:p%40ss@redis.example.com:6380/2') as Record<string, unknown>;
    assert.equal(secured.host, 'redis.example.com');
    assert.equal(secured.port, 6380);
    assert.equal(secured.username, 'user');
    assert.equal(secured.password, 'p@ss');
    assert.equal(secured.db, 2);
    assert.deepEqual(secured.tls, {});
  });

  it('seul le système peut refuser une demande qui expire ; une demande confirmée ne peut pas expirer', () => {
    assert.doesNotThrow(() => BookingStateMachine.assertCanTransition('PENDING', 'REFUSED', 'SYSTEM'));
    assert.throws(() => BookingStateMachine.assertCanTransition('CONFIRMED', 'REFUSED', 'SYSTEM'));
  });
});
