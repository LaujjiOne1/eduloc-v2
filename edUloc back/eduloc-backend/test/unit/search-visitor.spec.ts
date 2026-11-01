import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import { SearchController } from '../../src/modules/search/search.controller';
import type { SearchService } from '../../src/modules/search/search.service';

const jwt = new JwtService({ secret: 'secret-secret-secret-secret-secret-0123' });
const OTHER = new JwtService({ secret: 'une-autre-cle-une-autre-cle-une-autre-cle' });

const OFFERS = [
  { offerId: 'o1', tutor: { displayName: 'Lova R.', profilePhoto: 'https://x/y.jpg' }, price: 40000 },
  { offerId: 'o2', tutor: { displayName: 'Aina R.', profilePhoto: null }, price: 35000 },
  { offerId: 'o3', tutor: { displayName: 'Hery R.', profilePhoto: null }, price: 30000 },
];

function build() {
  const calls: unknown[] = [];
  const service = { searchOffers: async (input: unknown) => { calls.push(input); return OFFERS; } } as unknown as SearchService;
  return { controller: new SearchController(service, jwt), calls };
}

const query = { subjectId: '11111111-1111-4111-8111-111111111111', format: 'ONLINE', radiusM: 10000, limit: 20 } as never;
const bearer = (token: string) => `Bearer ${token}`;

describe('recherche : visiteur ou connecté', () => {
  it('un visiteur (sans jeton) ne reçoit QUE le nombre, jamais un nom, un tarif ni une photo', async () => {
    const { controller } = build();
    const result = await controller.offers(query);
    assert.deepEqual(result, { restricted: true, count: 3 });
    const text = JSON.stringify(result);
    for (const leaked of ['Lova', 'Aina', 'profilePhoto', 'price', 'o1', 'tutor']) assert.ok(!text.includes(leaked), `fuite : ${leaked}`);
  });

  it('un en-tête qui n\'est pas « Bearer » compte comme un visiteur', async () => {
    const { controller } = build();
    assert.deepEqual(await controller.offers(query, 'Basic abc'), { restricted: true, count: 3 });
  });

  it('un jeton valide reçoit les résultats complets, inchangés (un tableau)', async () => {
    const { controller } = build();
    const token = await jwt.signAsync({ sub: 'u1', isAdmin: false });
    const result = await controller.offers(query, bearer(token));
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 3);
  });

  it('un jeton invalide, expiré ou signé par une autre clé donne 401 (et non « visiteur »), pour que l\'application le renouvelle', async () => {
    const { controller, calls } = build();
    const forged = await OTHER.signAsync({ sub: 'u1' });
    const expired = await jwt.signAsync({ sub: 'u1' }, { expiresIn: -10 });
    for (const header of [bearer(forged), bearer(expired), bearer('nimporte.quoi.ici')]) {
      await assert.rejects(controller.offers(query, header), /TOKEN_INVALID/);
    }
    assert.equal(calls.length, 0, 'aucune recherche n\'est lancée pour un jeton invalide');
  });

  it('le nombre annoncé au visiteur est celui des résultats que verra l\'utilisateur connecté (même recherche)', async () => {
    const { controller, calls } = build();
    const visitor = (await controller.offers(query)) as { count: number };
    const token = await jwt.signAsync({ sub: 'u1' });
    const signedIn = (await controller.offers(query, bearer(token))) as unknown[];
    assert.equal(visitor.count, signedIn.length);
    assert.deepEqual(calls[0], calls[1]);
  });

  it('la validation reste la même pour tous : présentiel sans coordonnées = 400, même pour un visiteur', async () => {
    const { controller } = build();
    await assert.rejects(controller.offers({ ...(query as object), format: 'IN_PERSON' } as never), (error: { getResponse(): { message: string[] } }) =>
      error.getResponse().message.some((m) => m.includes('lat est requis')),
    );
  });
});
