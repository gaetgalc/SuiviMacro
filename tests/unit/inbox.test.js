import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireNombre, lireEnvoi, integrerEnvoi, jourCivil } from '../../js/core/inbox.js';

const envoi = {
  version: 1, envoye: '2026-11-24T07:05:00+01:00',
  poids: [{ date: '2026-11-24T19:00:00+01:00', kg: 80.6 }, { date: '2026-11-24T06:58:00+01:00', kg: '80,2' }],
  gras: [{ date: '2026-11-24T06:58:00+01:00', pct: '18,4 %' }],
  seances: [{ debut: '2026-11-23T19:00:00+01:00', fin: '2026-11-23T20:30:00+01:00', type: 'Football', dureeMin: 90, kcal: '720' }],
};
test('lireNombre', () => {
  assert.equal(lireNombre('80,2 kg'), 80.2);
  assert.equal(lireNombre('18,4 %'), 18.4);
  assert.equal(lireNombre(80.2), 80.2);
  assert.equal(lireNombre(''), null);
  assert.equal(lireNombre('abc'), null);
  assert.equal(lireNombre('1 234,5'), 1234.5);
});
test('jourCivil', () => {
  assert.equal(jourCivil('2026-11-24T00:30:00+01:00'), '2026-11-24');
  assert.equal(jourCivil('2026-11-24'), '2026-11-24');
});
test('lireEnvoi', () => {
  const r = lireEnvoi(envoi);
  assert.equal(r.poids.length, 2);
  assert.deepEqual(r.poids[1], { jour: '2026-11-24', heure: '06:58', kg: 80.2 });
  assert.equal(r.gras[0].pct, 18.4);
  assert.equal(r.seances[0].type, 'Football');
  assert.equal(r.seances[0].kcalActives, 720);
  assert.equal(r.seances[0].jour, '2026-11-23');
  assert.equal(r.ignores, 0);
});
test('valeurs illisibles et listes absentes', () => {
  const r = lireEnvoi({ poids: [{ date: '2026-11-24T07:00:00+01:00', kg: 'n/a' }] });
  assert.equal(r.ignores, 1);
  assert.deepEqual(r.seances, []);
  assert.deepEqual(lireEnvoi(null).poids, []);
});
test('intégration : pesée la plus matinale, manuel jamais écrasé, idempotent', () => {
  const maintenant = '2026-11-24T08:00:00.000Z';
  const r = integrerEnvoi(lireEnvoi(envoi), [], [], maintenant);
  const m = r.mesures.find(x => x.id === '2026-11-24');
  assert.equal(m.poids, 80.2);
  assert.equal(m.grasPct, 18.4);
  assert.equal(m.sources.poids, 'raccourci');
  assert.equal(r.seances.length, 1);
  assert.deepEqual(r.resume, { poids: 1, gras: 1, seances: 1, ignores: 0 });
  const r2 = integrerEnvoi(lireEnvoi(envoi), r.mesures, r.seances, maintenant);
  assert.equal(r2.mesures.length, 1);
  assert.equal(r2.seances.length, 1);
  const manuel = [{ id: '2026-11-24', poids: 81, sources: { poids: 'manuel' }, majLe: 'x' }];
  const r3 = integrerEnvoi(lireEnvoi(envoi), manuel, [], maintenant);
  assert.equal(r3.mesures[0].poids, 81);
  assert.equal(r3.mesures[0].grasPct, 18.4);
});
