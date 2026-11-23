import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionner, gagnant } from '../../js/core/fusion.js';

const r = (id, majLe, extra = {}) => ({ id, majLe, ...extra });

test('union par id', () => {
  assert.deepEqual(fusionner([r('b', '1')], [r('a', '1')]).map(x => x.id), ['a', 'b']);
});
test('le plus récent gagne, dans les deux sens', () => {
  const a = [r('x', '2026-11-23T10:00:00.000Z', { v: 1 })];
  const b = [r('x', '2026-11-23T11:00:00.000Z', { v: 2 })];
  assert.equal(fusionner(a, b)[0].v, 2);
  assert.deepEqual(fusionner(a, b), fusionner(b, a));
});
test('égalité départagée par appareil', () => {
  const x = r('x', 't', { appareil: 'a', v: 1 }), y = r('x', 't', { appareil: 'b', v: 2 });
  assert.equal(gagnant(x, y).v, 2);
  assert.equal(gagnant(y, x).v, 2);
});
test('idempotence', () => {
  const x = [r('b', '2'), r('a', '1')];
  assert.deepEqual(fusionner(x, x), [r('a', '1'), r('b', '2')]);
});
test('pierres tombales', () => {
  const vivant = r('x', '2026-11-23T10:00:00Z'), mort = r('x', '2026-11-23T11:00:00Z', { supprime: true });
  assert.equal(fusionner([vivant], [mort])[0].supprime, true);
  const ressuscite = r('x', '2026-11-23T12:00:00Z', { v: 3 });
  assert.equal(fusionner([mort], [ressuscite])[0].supprime, undefined);
});
test('aucun id perdu (tirages aléatoires)', () => {
  let graine = 42;
  const alea = () => (graine = (graine * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let i = 0; i < 200; i++) {
    const liste = () => Array.from({ length: Math.floor(alea() * 8) }, () => r('id' + Math.floor(alea() * 10), String(Math.floor(alea() * 5)), { appareil: alea() < 0.5 ? 'a' : 'b' }));
    const a = liste(), b = liste();
    const ids = new Set([...a, ...b].map(x => x.id));
    const f = fusionner(a, b);
    assert.equal(f.length, ids.size);
    assert.deepEqual(f, fusionner(b, a));
  }
});
