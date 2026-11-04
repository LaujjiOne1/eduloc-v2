import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { bookableDurations, durationsForWindow } from '../../src/modules/bookings/domain/offer-durations';
import type { AvailabilityRule } from '../../src/modules/bookings/domain/slot-policy';

const rule = (startTime: string, endTime: string, over: Partial<AvailabilityRule> = {}): AvailabilityRule => ({
  id: `${startTime}-${endTime}`, dayOfWeek: 1, startTime, endTime, timezone: 'Indian/Antananarivo',
  validFrom: null, validUntil: null, isActive: true, offerId: null, placeId: null, placeType: null, ...over,
});
const offer = { id: 'o1', durationMinutes: 60, durationOptions: [] as number[] };

describe('durées déduites des plages de disponibilité', () => {
  it('une plage de 4 h propose de 1 h à 4 h par pas de 30 min', () => {
    assert.deepEqual(durationsForWindow(240), [60, 90, 120, 150, 180, 210, 240]);
  });

  it('une plage de 1 h30 propose 1 h et 1 h30 ; une plage de 1 h seulement 1 h ; moins d\'1 h : rien', () => {
    assert.deepEqual(durationsForWindow(90), [60, 90]);
    assert.deepEqual(durationsForWindow(60), [60]);
    assert.deepEqual(durationsForWindow(45), []);
  });

  it('utilise la plus longue plage du Tuteur', () => {
    assert.deepEqual(bookableDurations(offer, [rule('09:00', '10:00'), rule('14:00', '16:00')]), [60, 90, 120]);
  });

  it('ignore les plages inactives et celles d\'une autre offre', () => {
    const rules = [rule('08:00', '12:00', { isActive: false }), rule('08:00', '12:00', { offerId: 'autre' }), rule('14:00', '15:00')];
    assert.deepEqual(bookableDurations(offer, rules), [60]);
  });

  it('filtre par mode : une plage « en ligne » n\'ouvre pas la salle partenaire', () => {
    const rules = [rule('14:00', '18:00', { placeType: 'ONLINE' }), rule('09:00', '10:30', { placeType: 'PARTNER_ROOM' })];
    assert.deepEqual(bookableDurations(offer, rules, 'ONLINE'), [60, 90, 120, 150, 180, 210, 240]);
    assert.deepEqual(bookableDurations(offer, rules, 'PARTNER_ROOM'), [60, 90]);
  });

  it('garde les durées configurées sur l\'offre tant qu\'elles tiennent dans la plage', () => {
    const custom = { id: 'o1', durationMinutes: 45, durationOptions: [45, 600] };
    assert.deepEqual(bookableDurations(custom, [rule('14:00', '16:00')]), [45, 60, 90, 120]);
  });

  it('sans plage d\'au moins 1 h, retombe sur les durées de l\'offre', () => {
    assert.deepEqual(bookableDurations({ id: 'o1', durationMinutes: 45, durationOptions: [30] }, [rule('14:00', '14:45')]), [30, 45]);
    assert.deepEqual(bookableDurations(offer, []), [60]);
  });
});
