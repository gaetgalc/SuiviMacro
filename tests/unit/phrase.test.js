import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyserPhrase, consigneClaude, extraireJson, lignesDepuisJson, platsVersAliments, portionsPour, resoudre } from '../../js/core/phrase.js';
import { ciqualVersAliments, creerIndex } from '../../js/core/recherche.js';

const lire = f => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url)));
const plats = lire('plats.json'), portions = lire('portions.json');
const index = creerIndex([...ciqualVersAliments(lire('ciqual.json')), ...platsVersAliments(plats)]);

test('données plats et portions valides', () => {
  assert.ok(plats.length >= 80);
  for (const p of plats) { assert.ok(p.portions[0].g > 0, p.id); assert.ok(p.p100.kcal > 0, p.id); }
  for (const p of portions) for (const x of p.portions) assert.ok(x.g > 0, p.cle);
});
test('curry grosse portion et un skyr', () => {
  const l = analyserPhrase('curry pois chiches riz, grosse portion et un skyr', index);
  assert.equal(l.length, 2);
  assert.equal(l[0].choix[0].nom, 'Curry de pois chiches et riz');
  assert.equal(l[0].facteur, 1.3);
  assert.match(l[1].choix[0].nom, /^Skyr/);
  assert.equal(l[1].qte, 1);
  assert.equal(l[1].unite, 'pot');
});
test('grammes explicites', () => {
  const [l] = analyserPhrase('200 g de lentilles', index);
  assert.equal(l.qte, 200); assert.equal(l.unite, 'g');
  assert.match(l.choix[0].nom, /Lentille/);
});
test('nombres en lettres', () => {
  const [f] = analyserPhrase('deux falafels', index);
  assert.equal(f.qte, 2); assert.equal(f.unite, 'piece');
  const [a] = analyserPhrase('un demi avocat', index, portions);
  assert.equal(a.qte, 0.5);
  assert.equal(a.unite, 'piece');
});
test('mot inconnu', () => {
  const [z] = analyserPhrase('zorglub', index);
  assert.ok(z.confiance < 0.5);
  assert.equal(z.choix.length, 0);
});
test('resoudre applique le facteur', () => {
  const [l] = analyserPhrase('grosse pizza margherita', index);
  assert.deepEqual(resoudre(l), { aliment: l.choix[0], qte: 1.3, unite: 'pizza' });
});
test('portionsPour', () => {
  const oeuf = { nom: 'Oeuf, dur', portions: [] };
  assert.deepEqual(portionsPour(oeuf, portions).map(p => p.g), [50]);
  const perso = { nom: 'Tofu fumé', portions: [{ id: 'tranche', nom: 'tranche', g: 30 }] };
  assert.deepEqual(portionsPour(perso, portions).map(p => p.id), ['tranche', 'portion', 'bloc']);
});
test('consigne pour Claude', () => {
  const c = consigneClaude('poké bowl tofu');
  assert.match(c, /poké bowl tofu/);
  assert.match(c, /"aliments"/);
});
test('extraireJson', () => {
  assert.deepEqual(extraireJson('Voici :\n```json\n{"aliments":[]}\n```'), { aliments: [] });
  assert.deepEqual(extraireJson('blabla {"a": {"b": 1}} fin'), { a: { b: 1 } });
  assert.equal(extraireJson('rien ici'), null);
});
test('lignesDepuisJson', () => {
  const l = lignesDepuisJson({ aliments: [{ nom: 'Riz', g: 200, kcal: 260, prot: 5, gluc: 56, lip: 0.6, fib: 0.8, origineProt: 'cereales' }, { nom: 'Bizarre', g: 'x' }] });
  assert.equal(l.length, 1);
  assert.equal(l[0].qte, 200); assert.equal(l[0].unite, 'g');
  assert.equal(l[0].choix[0].p100.kcal, 130);
  assert.equal(l[0].confiance, 1);
});
test('virgule décimale française dans une phrase', () => {
  const l = analyserPhrase('1,5 bol de riz cuit, un skyr', index, portions);
  assert.equal(l.length, 2);
  assert.equal(l[0].qte, 1.5);
  assert.match(l[1].choix[0].nom, /^Skyr/);
});
