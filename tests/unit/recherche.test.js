import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliser, ciqualVersAliments, creerIndex, ajouterAIndex, chercher } from '../../js/core/recherche.js';

const table = JSON.parse(readFileSync(new URL('../../data/ciqual.json', import.meta.url)));
const aliments = ciqualVersAliments(table);
const index = creerIndex(aliments);
const skyrPerso = { id: 'perso:skyr', source: 'perso', nom: 'Skyr nature', p100: { kcal: 60, prot: 10, gluc: 4, lip: 0.2, fib: 0 }, portions: [] };
ajouterAIndex(index, skyrPerso);

test('normaliser', () => {
  assert.deepEqual(normaliser('Flocons d\'avoine'), ['flocon', 'avoine']);
  assert.deepEqual(normaliser('Pâtes  complètes'), ['pate', 'complete']);
  assert.deepEqual(normaliser('pois chiches cuits'), normaliser('Pois chiche, cuit'));
});
test('aliments Ciqual convertis', () => {
  const tofu = aliments.find(a => a.nom.startsWith('Tofu nature'));
  assert.equal(tofu.source, 'ciqual');
  assert.match(tofu.id, /^ciqual:\d+$/);
  assert.equal(tofu.origineProt, 'soja');
  assert.ok(tofu.p100.prot > 10);
});
const attendus = {
  'tofu': /^Tofu/,
  'pois chiches cuits': /^Pois chiche.*cuit/,
  'skyr': /^Skyr/,
  'lentilles corail': /^Lentille corail/,
  'seitan': /^Seitan/,
  'tempeh': /^Tempeh/,
  "flocons d'avoine": /^Flocons d'avoine/,
  'beurre de cacahuète': /(cacahu|arachide)/i,
  'pates': /^Pâtes/,
};
for (const [q, re] of Object.entries(attendus)) {
  test(`« ${q} » dans les 5 premiers`, () => {
    const r = chercher(index, q, {}).slice(0, 5).map(x => x.aliment.nom);
    assert.ok(r.some(n => re.test(n)), `${q} → ${r.join(' | ')}`);
  });
}
test('usages remontent un aliment', () => {
  const sans = chercher(index, 'tofu', {});
  const dernier = sans[sans.length - 1].aliment;
  const avec = chercher(index, 'tofu', { usages: new Map([[dernier.id, { n: 10, dernier: '2026-11-20' }]]) });
  assert.equal(avec[0].aliment.id, dernier.id);
});
test('requête vide ou inconnue', () => {
  assert.deepEqual(chercher(index, '', {}), []);
  assert.deepEqual(chercher(index, 'zorglubxyz', {}), []);
});
test('moins de 100 ms', () => {
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) chercher(index, ['tofu', 'pois chiche', 'lentille corail', 'avoine'][i % 4], {});
  const moy = (performance.now() - t0) / 20;
  assert.ok(moy < 100, `${moy} ms`);
});
