import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habituels, suggerer } from '../../js/core/suggestions.js';

const al = (id, kcal, prot) => ({ id, nom: id, p100: { kcal, prot, gluc: 0, lip: 0, fib: 0 }, portions: [] });
const skyr = al('skyr', 60, 10), whey = al('whey', 400, 80), chips = al('chips', 540, 6);
const h = [
  { aliment: skyr, qte: 250, unite: 'g', n: 5 },
  { aliment: whey, qte: 30, unite: 'g', n: 8 },
  { aliment: chips, qte: 50, unite: 'g', n: 3 },
];
test('skyr + whey en premier', () => {
  const s = suggerer({ restant: { prot: 40, kcal: 400 }, habituels: h });
  assert.deepEqual(s[0].items.map(i => i.aliment.id).sort(), ['skyr', 'whey']);
  assert.ok(s.length <= 3);
  assert.ok(s.every(x => x.kcal <= 440));
  assert.equal(Math.round(s[0].prot), 49);
});
test('rien sous 20 g de protéines restantes', () => {
  assert.deepEqual(suggerer({ restant: { prot: 15, kcal: 400 }, habituels: h }), []);
});
test('habituels sur 30 jours, par fréquence et par repas', () => {
  const e = (jour, alimentId, repas, qte = 100) => ({ jour, alimentId, repas, qte, unite: 'g', heure: '12:00', majLe: jour });
  const entrees = [
    e('2026-11-20', 'skyr', 'collation', 150), e('2026-11-21', 'skyr', 'collation', 250), e('2026-11-22', 'whey', 'collation'),
    e('2026-11-22', 'chips', 'dejeuner'), e('2026-10-01', 'chips', 'collation'), { ...e('2026-11-22', 'skyr', 'collation'), supprime: true },
  ];
  const aliments = new Map([skyr, whey, chips].map(a => [a.id, a]));
  const r = habituels(entrees, aliments, '2026-11-23', 'collation');
  assert.deepEqual(r.map(x => x.aliment.id), ['skyr', 'whey']);
  assert.equal(r[0].n, 2);
  assert.equal(r[0].qte, 250);
  assert.equal(habituels(entrees, aliments, '2026-11-23').length, 3);
});
