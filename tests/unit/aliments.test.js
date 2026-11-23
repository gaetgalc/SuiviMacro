import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { ouvrirBase } from '../../js/data/db.js';
import { adopter, ajouterEntree, ajouterRepasType, annuler, modifierAliment } from '../../js/data/aliments.js';

const tofu = { id: 'ciqual:20904', source: 'ciqual', ref: '20904', nom: 'Tofu nature', p100: { kcal: 120, prot: 12, gluc: 2, lip: 7, fib: 1 }, portions: [], origineProt: 'soja' };
const base = () => ouvrirBase({ nom: 'a', idb: new IDBFactory() });

test('adopter : une seule copie par source et référence', async () => {
  const b = await base();
  const a1 = await adopter(b, tofu);
  const a2 = await adopter(b, { ...tofu });
  assert.equal(a1.id, a2.id);
  assert.equal((await b.tous('aliments')).length, 1);
});
test('ajouterEntree fige les valeurs et retient la quantité', async () => {
  const b = await base();
  const e = await ajouterEntree(b, { aliment: tofu, qte: 150, unite: 'g', jour: '2026-11-23', repas: 'dejeuner', heure: '12:41', mode: 'recherche', grignotage: null });
  assert.equal(e.kcal, 180);
  assert.equal(e.origineProt, 'soja');
  const a = await b.lire('aliments', e.alimentId);
  assert.deepEqual(a.derniere, { qte: 150, unite: 'g' });
  assert.equal(a.utilisations, 1);
  assert.equal(a.dernierUsage, '2026-11-23');
  await modifierAliment(b, { ...a, p100: { ...a.p100, kcal: 999 } });
  assert.equal((await b.lire('entrees', e.id)).kcal, 180);
});
test('modifierAliment peut réappliquer aux entrées passées', async () => {
  const b = await base();
  const e = await ajouterEntree(b, { aliment: tofu, qte: 100, unite: 'g', jour: '2026-11-23', repas: 'dejeuner', heure: '12:00', mode: 'recherche' });
  const a = await b.lire('aliments', e.alimentId);
  await modifierAliment(b, { ...a, p100: { ...a.p100, kcal: 200 } }, { passees: true });
  assert.equal((await b.lire('entrees', e.id)).kcal, 200);
});
test('repas enregistré et annulation', async () => {
  const b = await base();
  const a = await adopter(b, tofu);
  const rt = { id: 'rt1', nom: 'Bol du midi', items: [{ alimentId: a.id, qte: 200, unite: 'g' }, { alimentId: 'inconnu', qte: 1, unite: 'g' }] };
  const es = await ajouterRepasType(b, rt, '2026-11-23', 'dejeuner', '12:00');
  assert.equal(es.length, 1);
  assert.equal(es[0].mode, 'repas');
  await annuler(b, es.map(x => x.id));
  assert.equal((await b.tous('entrees')).length, 0);
});
test('estimations IA du même plat : un seul aliment', async () => {
  const b = await base();
  const ia = (kcal, n) => ({ id: `ia:${n}`, source: 'ia', nom: 'Poké tofu', p100: { kcal, prot: 7, gluc: 20, lip: 4, fib: 2 }, portions: [], origineProt: 'soja' });
  const e1 = await ajouterEntree(b, { aliment: ia(150, 1), qte: 450, unite: 'g', jour: '2026-11-23', repas: 'dejeuner', heure: '12:00', mode: 'phrase' });
  const e2 = await ajouterEntree(b, { aliment: ia(160, 2), qte: 400, unite: 'g', jour: '2026-11-24', repas: 'dejeuner', heure: '12:00', mode: 'phrase' });
  assert.equal(e1.alimentId, e2.alimentId);
  assert.equal((await b.tous('aliments')).length, 1);
  assert.equal(Math.round(e1.kcal), 675);
  assert.equal(Math.round(e2.kcal), 640);
});
