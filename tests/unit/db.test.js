import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { ouvrirBase, fichierDe, magasinsDuFichier } from '../../js/data/db.js';

let t = 0;
const horloge = () => new Date(Date.UTC(2026, 10, 23, 10, 0, t++)).toISOString();
const base = () => ouvrirBase({ nom: 'test', idb: new IDBFactory(), horloge });

test('fichierDe', () => {
  assert.equal(fichierDe('entrees', { jour: '2026-11-23' }), 'journal/2026-11.json');
  assert.equal(fichierDe('jours', { id: '2026-11-23' }), 'journal/2026-11.json');
  assert.equal(fichierDe('seances', { jour: '2026-11-23' }), 'seances/2026.json');
  assert.equal(fichierDe('repasTypes', {}), 'repas-types.json');
  assert.equal(fichierDe('mesures', {}), 'mesures.json');
  assert.deepEqual(magasinsDuFichier('journal/2026-11.json'), ['entrees', 'jours']);
});
test('écrire, lire, supprimer', async () => {
  const b = await base();
  const e = await b.ecrire('entrees', { id: 'e1', jour: '2026-11-23', nom: 'Tofu', kcal: 180 });
  assert.ok(e.majLe); assert.ok(e.appareil);
  assert.equal((await b.lire('entrees', 'e1')).nom, 'Tofu');
  assert.deepEqual(await b.aEnvoyer(), ['journal/2026-11.json']);
  assert.equal((await b.parIndex('entrees', 'jour', '2026-11-23')).length, 1);
  await b.supprimer('entrees', 'e1');
  assert.equal((await b.tous('entrees')).length, 0);
  assert.equal((await b.tous('entrees', { avecSupprimes: true }))[0].supprime, true);
  assert.equal((await b.parIndex('entrees', 'jour', '2026-11-23')).length, 0);
});
test('fusionnerFichier ne marque rien à envoyer', async () => {
  const b = await base();
  const r = await b.fusionnerFichier('mesures.json', { mesures: [{ id: '2026-11-23', poids: 80, majLe: 'a' }] });
  assert.deepEqual(await b.aEnvoyer(), []);
  assert.equal((await b.lire('mesures', '2026-11-23')).poids, 80);
  assert.equal(r.aRenvoyer, false);
});
test('fusionnerFichier signale un local plus récent', async () => {
  const b = await base();
  await b.ecrire('mesures', { id: '2026-11-23', poids: 81 });
  const r = await b.fusionnerFichier('mesures.json', { mesures: [{ id: '2026-11-23', poids: 80, majLe: '2000-01-01T00:00:00.000Z' }] });
  assert.equal(r.aRenvoyer, true);
  assert.equal((await b.lire('mesures', '2026-11-23')).poids, 81);
});
test('contenuDuFichier par mois', async () => {
  const b = await base();
  await b.ecrire('entrees', { id: 'a', jour: '2026-11-01' });
  await b.ecrire('entrees', { id: 'b', jour: '2026-12-01' });
  await b.ecrire('jours', { id: '2026-11-02', statut: 'complet' });
  const c = await b.contenuDuFichier('journal/2026-11.json');
  assert.deepEqual(c.entrees.map(x => x.id), ['a']);
  assert.deepEqual(c.jours.map(x => x.id), ['2026-11-02']);
});
test('envoye efface la marque sauf écriture entre-temps', async () => {
  const b = await base();
  await b.ecrire('mesures', { id: 'x', poids: 1 });
  const v = (await b.etat('mesures.json')).version;
  await b.ecrire('mesures', { id: 'y', poids: 2 });
  await b.envoye('mesures.json', 'sha1', v);
  assert.deepEqual(await b.aEnvoyer(), ['mesures.json']);
  await b.envoye('mesures.json', 'sha2', (await b.etat('mesures.json')).version);
  assert.deepEqual(await b.aEnvoyer(), []);
  assert.equal((await b.etat('mesures.json')).sha, 'sha2');
});
test('export / import sans les secrets', async () => {
  const a = await base();
  await a.poserSecret('jeton', 'secret-fictif');
  await a.ecrire('aliments', { id: 'perso:1', nom: 'Pâtes complètes' });
  await a.ecrire('reglages', { id: 'reglages', cibles: { kcal: 2000 } });
  const exp = await a.exporter();
  assert.ok(!JSON.stringify(exp).includes('secret-fictif'));
  const b = await base();
  await b.importer(exp);
  assert.equal((await b.lire('aliments', 'perso:1')).nom, 'Pâtes complètes');
  assert.equal((await b.lire('reglages', 'reglages')).cibles.kcal, 2000);
  assert.equal(await a.secret('jeton'), 'secret-fictif');
  assert.ok((await b.aEnvoyer()).includes('aliments.json'));
});
test('surChangement', async () => {
  const b = await base();
  const vus = [];
  b.surChangement(m => vus.push(m));
  await b.ecrire('jours', { id: '2026-11-23', statut: 'complet' });
  assert.deepEqual(vus, ['jours']);
});
