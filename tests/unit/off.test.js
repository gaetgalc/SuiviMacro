import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { ouvrirBase } from '../../js/data/db.js';
import { creerOff, versAliment } from '../../js/data/off.js';

const fiche = (n = {}) => ({ code: '3017620422003', product_name: 'Tofu ferme', product_name_fr: 'Tofu ferme bio', brands: 'Marque A', serving_quantity: 125, categories_tags: ['en:tofu'], nutriments: { 'energy-kcal_100g': 120, proteins_100g: 12, carbohydrates_100g: 2, fat_100g: 7, fiber_100g: 1, ...n } });

test('fiche complète', () => {
  const a = versAliment(fiche());
  assert.equal(a.id, 'off:3017620422003');
  assert.equal(a.source, 'off');
  assert.equal(a.nom, 'Tofu ferme bio');
  assert.equal(a.marque, 'Marque A');
  assert.deepEqual(a.p100, { kcal: 120, prot: 12, gluc: 2, lip: 7, fib: 1 });
  assert.deepEqual(a.portions, [{ id: 'portion', nom: 'portion (125 g)', g: 125 }]);
  assert.equal(a.origineProt, 'soja');
});
test('kcal depuis kJ ou macros', () => {
  assert.equal(versAliment(fiche({ 'energy-kcal_100g': undefined, energy_100g: 418.4 })).p100.kcal, 100);
  assert.equal(versAliment(fiche({ 'energy-kcal_100g': undefined })).p100.kcal, 4 * 12 + 4 * 2 + 9 * 7);
  assert.equal(versAliment({ code: '1', product_name: 'Rien', nutriments: {} }).incomplet, true);
  assert.equal(versAliment({ code: '1', nutriments: { 'energy-kcal_100g': 50 } }).nom, 'Produit 1');
  assert.equal(versAliment({ ...fiche(), brands: ['A', 'B'] }).marque, 'A, B');
  assert.equal(versAliment(fiche({ fiber_100g: undefined })).p100.fib, null);
});
test('produit : cache et absence', async () => {
  const base = await ouvrirBase({ nom: 'o', idb: new IDBFactory() });
  let n = 0;
  const fetch = async url => {
    n++;
    if (String(url).includes('000')) return new Response(JSON.stringify({ status: 0 }), { status: 404 });
    return new Response(JSON.stringify({ status: 1, product: fiche() }));
  };
  const off = creerOff({ fetch, base, maintenant: () => Date.UTC(2026, 10, 23) });
  assert.equal((await off.produit('3017620422003')).nom, 'Tofu ferme bio');
  await off.produit('3017620422003');
  assert.equal(n, 1);
  assert.equal(await off.produit('000'), null);
});
test('chercher : URL et résultats', async () => {
  let vue;
  const fetch = async url => { vue = String(url); return new Response(JSON.stringify({ hits: [{ ...fiche(), brands: ['A'] }, { code: '2', product_name: 'Vide', nutriments: {} }] })); };
  const off = creerOff({ fetch, base: null });
  const r = await off.chercher('tofu nature');
  assert.match(vue, /^https:\/\/search\.openfoodfacts\.org\/search\?/);
  assert.match(vue, /langs=fr/);
  assert.match(vue, /page_size=20/);
  assert.match(vue, /q=tofu\+nature|q=tofu%20nature/);
  assert.equal(r.length, 1);
});
