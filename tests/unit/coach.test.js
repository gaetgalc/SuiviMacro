import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposerCibles, partGlucidesDepuis, bilanDu, resumeSemaine } from '../../js/core/coach.js';
import { serieTendance } from '../../js/core/tendance.js';

const reglages = { cibles: { kcal: 2100, prot: 120, gluc: 220, lip: 65, fib: 30 }, partGlucides: 0.6, rythmePct: 0.5 };

test('partGlucides depuis les cibles', () => {
  assert.equal(partGlucidesDepuis({ gluc: 220, lip: 65 }), 880 / (880 + 585));
});
test('déficit 0,5 % de 80 kg', () => {
  assert.equal(proposerCibles({ depense: 2500, tendanceKg: 80, reglages, mb: 1700 }).deficit, 440);
});
test('répartition des macros', () => {
  const r = proposerCibles({ depense: 2500, tendanceKg: 80, reglages, mb: 1700 });
  assert.deepEqual(r.cibles, { kcal: 2060, prot: 120, gluc: 237, lip: 70, fib: 30 });
  assert.equal(r.plancherKcal, false);
  assert.equal(r.plancherLipides, false);
  assert.ok(r.explication.length >= 3);
});
test('plancher au métabolisme de base', () => {
  const r = proposerCibles({ depense: 2000, tendanceKg: 80, reglages, mb: 1780 });
  assert.equal(r.cibles.kcal, 1780);
  assert.equal(r.plancherKcal, true);
  assert.match(r.explication.join(' '), /métabolisme de base/);
});
test('plancher lipides 0,6 g/kg', () => {
  const r = proposerCibles({ depense: 2500, tendanceKg: 80, reglages: { ...reglages, partGlucides: 0.8 }, mb: 1700 });
  assert.equal(r.cibles.lip, 48);
  assert.equal(r.cibles.gluc, Math.round((2060 - 480 - 48 * 9) / 4));
  assert.equal(r.plancherLipides, true);
});
test('protéines fixes', () => {
  for (const d of [1800, 2500, 3500]) assert.equal(proposerCibles({ depense: d, tendanceKg: 80, reglages, mb: 1500 }).cibles.prot, 120);
});
test('bilanDu', () => {
  assert.deepEqual(bilanDu('2026-11-23', 1, [], '2026-11-01'), { semaine: '2026-W47' });
  assert.deepEqual(bilanDu('2026-11-25', 1, [], '2026-11-01'), { semaine: '2026-W47' });
  assert.equal(bilanDu('2026-11-23', 1, [{ id: '2026-W47', decision: 'acceptee' }], '2026-11-01'), null);
  assert.equal(bilanDu('2026-11-23', 1, [], '2026-11-15'), null);
  assert.equal(bilanDu('2026-11-23', 3, [], '2026-11-01'), null);
  assert.deepEqual(bilanDu('2026-11-25', 3, [], '2026-11-01'), { semaine: '2026-W47' });
});
test('resumeSemaine', () => {
  const entrees = [
    { jour: '2026-11-16', kcal: 2000, prot: 120, fib: 20, grignotage: null },
    { jour: '2026-11-17', kcal: 1800, prot: 100, fib: 30, grignotage: { raison: 'faim' } },
    { jour: '2026-11-23', kcal: 5000, prot: 1, fib: 1 },
  ];
  const serie = serieTendance([{ id: '2026-11-15', poids: 80 }, { id: '2026-11-22', poids: 79 }], '2026-11-22');
  const r = resumeSemaine({ semaine: '2026-W47', entrees, serie });
  assert.equal(r.joursSaisis, 2);
  assert.equal(r.apportsMoyens, 1900);
  assert.equal(r.protMoyennes, 110);
  assert.equal(r.fibMoyennes, 25);
  assert.equal(r.grignotages, 1);
  assert.ok(Math.abs(r.deltaTendance - (-0.1)) < 1e-9);
});
test('pas de bilan sans pesée', () => {
  assert.equal(bilanDu('2026-11-23', 1, [], '2026-11-01', false), null);
  assert.deepEqual(bilanDu('2026-11-23', 1, [], '2026-11-01', true), { semaine: '2026-W47' });
});
test('bilan le dimanche : la semaine qui se termine', () => {
  assert.deepEqual(bilanDu('2026-11-29', 7, [], '2026-11-01'), { semaine: '2026-W48' });
  assert.equal(bilanDu('2026-11-28', 7, [], '2026-11-01'), null);
});
