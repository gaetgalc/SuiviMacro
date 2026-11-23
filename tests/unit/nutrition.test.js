import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireQuantite, grammes, valeurs, somme, restant, p100Recette, kcalDepuisMacros } from '../../js/core/nutrition.js';

const tofu = { p100: { kcal: 120, prot: 12, gluc: 2, lip: 7, fib: 1 }, portions: [] };
const skyr = { p100: { kcal: 60, prot: 10, gluc: 4, lip: 0.2, fib: null }, portions: [{ id: 'pot', nom: 'pot', g: 125 }] };
const proche = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('lireQuantite accepte la virgule française', () => {
  assert.equal(lireQuantite('1,5'), 1.5);
  assert.equal(lireQuantite('0.5'), 0.5);
  assert.equal(lireQuantite(' 2 '), 2);
  assert.equal(lireQuantite('1/2'), 0.5);
  assert.equal(lireQuantite(''), null);
  assert.equal(lireQuantite('abc'), null);
  assert.equal(lireQuantite('-3'), null);
  assert.equal(lireQuantite(undefined), null);
});
test('valeurs en grammes', () => {
  const v = valeurs(tofu, 150, 'g');
  assert.equal(v.g, 150); proche(v.kcal, 180); proche(v.prot, 18); proche(v.gluc, 3); proche(v.lip, 10.5); proche(v.fib, 1.5);
});
test('ml compté comme g', () => assert.equal(grammes(tofu, 200, 'ml'), 200));
test('portion', () => {
  assert.equal(grammes(skyr, 2, 'pot'), 250);
  assert.equal(valeurs(skyr, 1, 'pot').fib, null);
});
test('somme ignore les supprimées', () => {
  const t = somme([{ kcal: 100, prot: 10, gluc: 1, lip: 1, fib: 2 }, { kcal: 50, prot: 5, gluc: 1, lip: 1, fib: null }, { kcal: 999, prot: 9, gluc: 9, lip: 9, fib: 9, supprime: true }]);
  assert.deepEqual(t, { kcal: 150, prot: 15, gluc: 2, lip: 2, fib: 2 });
});
test('restant peut être négatif', () => {
  assert.deepEqual(restant({ kcal: 2000, prot: 110, gluc: 200, lip: 60, fib: 30 }, { kcal: 2100, prot: 100, gluc: 150, lip: 80, fib: 10 }),
    { kcal: -100, prot: 10, gluc: 50, lip: -20, fib: 20 });
});
test('p100Recette avec poids cuit', () => {
  const r = p100Recette([{ aliment: tofu, g: 200 }, { aliment: skyr, g: 100 }], 600);
  proche(r.kcal, (240 + 60) / 6); proche(r.prot, (24 + 10) / 6);
  const cru = p100Recette([{ aliment: tofu, g: 200 }, { aliment: skyr, g: 100 }]);
  proche(cru.kcal, 300 / 3);
});
test('kcalDepuisMacros', () => assert.equal(kcalDepuisMacros(10, 20, 5), 165));
