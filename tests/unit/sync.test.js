import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { ouvrirBase } from '../../js/data/db.js';
import { creerDepot } from '../../js/data/depot.js';
import { creerSync } from '../../js/data/sync.js';
import { fauxGithub } from './faux-github.js';

let t = 0;
const horloge = () => new Date(Date.UTC(2026, 10, 23, 10, 0, 0, t++)).toISOString();
async function appareil(gh, jeton = 'jeton-fictif') {
  const base = await ouvrirBase({ nom: 'x', idb: new IDBFactory(), horloge });
  const depot = creerDepot({ jeton, fetch: gh.fetch });
  return { base, sync: creerSync({ base, depot, horloge }) };
}
const entree = (id, jour = '2026-11-23', nom = 'Tofu') => ({ id, jour, nom, kcal: 100, repas: 'dejeuner' });

test('A envoie, B reçoit', async () => {
  const gh = fauxGithub();
  const A = await appareil(gh), B = await appareil(gh);
  await A.base.ecrire('entrees', entree('e1'));
  await A.sync.synchroniser();
  assert.deepEqual(await A.base.aEnvoyer(), []);
  await B.sync.synchroniser();
  assert.equal((await B.base.lire('entrees', 'e1')).nom, 'Tofu');
  const f = JSON.parse(gh.lireTexte('journal/2026-11.json'));
  assert.equal(f.version, 1);
  assert.equal(f.entrees.length, 1);
});
test('modifications croisées hors ligne : aucune perte', async () => {
  for (const ordre of [['A', 'B'], ['B', 'A']]) {
    const gh = fauxGithub();
    const X = { A: await appareil(gh), B: await appareil(gh) };
    await X.A.base.ecrire('entrees', entree('a1'));
    await X.B.base.ecrire('entrees', entree('b1'));
    await X[ordre[0]].sync.synchroniser();
    await X[ordre[1]].sync.synchroniser();
    await X[ordre[0]].sync.synchroniser();
    for (const k of ['A', 'B']) assert.deepEqual((await X[k].base.tous('entrees')).map(e => e.id).sort(), ['a1', 'b1'], ordre.join());
  }
});
test('suppression propagée', async () => {
  const gh = fauxGithub();
  const A = await appareil(gh), B = await appareil(gh);
  await A.base.ecrire('entrees', entree('e1'));
  await A.sync.synchroniser(); await B.sync.synchroniser();
  await A.base.supprimer('entrees', 'e1');
  await A.sync.synchroniser(); await B.sync.synchroniser();
  assert.equal((await B.base.tous('entrees')).length, 0);
});
test('écriture concurrente pendant l\'envoi : 409 puis réussite', async () => {
  const gh = fauxGithub();
  const A = await appareil(gh), B = await appareil(gh);
  await B.base.ecrire('entrees', entree('b1'));
  await B.sync.synchroniser();
  await A.base.ecrire('entrees', entree('a1'));
  gh.avantProchainPut(() => gh.ecrireDepuisAilleurs('journal/2026-11.json', JSON.stringify({ version: 1, entrees: [{ ...entree('c1'), majLe: '2026-11-23T09:00:00.000Z' }], jours: [] })));
  await A.sync.synchroniser();
  const f = JSON.parse(gh.lireTexte('journal/2026-11.json'));
  assert.deepEqual(f.entrees.map(e => e.id).sort(), ['a1', 'b1', 'c1']);
  assert.ok((await A.base.lire('entrees', 'c1')));
  assert.equal(A.sync.etat().erreur, null);
});
test('jeton refusé : erreur et modifications en attente', async () => {
  const gh = fauxGithub();
  const A = await appareil(gh, 'mauvais');
  await A.base.ecrire('entrees', entree('e1'));
  await A.sync.synchroniser();
  assert.equal(A.sync.etat().erreur, 'jeton');
  assert.deepEqual(await A.base.aEnvoyer(), ['journal/2026-11.json']);
  assert.equal(A.sync.etat().enAttente, 1);
});
test('boîte de réception intégrée une seule fois puis supprimée', async () => {
  const gh = fauxGithub();
  const A = await appareil(gh);
  const envoi = { poids: [{ date: '2026-11-24T06:58:00+01:00', kg: '80,2' }], seances: [{ debut: '2026-11-23T19:00:00+01:00', type: 'Football', dureeMin: 90 }] };
  gh.ecrireDepuisAilleurs('inbox/2026-11-24T07-05-00.json', JSON.stringify(envoi));
  await A.sync.synchroniser();
  assert.equal((await A.base.lire('mesures', '2026-11-24')).poids, 80.2);
  assert.equal(gh.fichiers.has('inbox/2026-11-24T07-05-00.json'), false);
  assert.ok(gh.lireTexte('mesures.json').includes('80.2'));
  assert.ok(gh.lireTexte('seances/2026.json').includes('Football'));
  assert.equal(A.sync.etat().dernierEnvoi.resume.poids, 1);
  gh.ecrireDepuisAilleurs('inbox/2026-11-24T07-06-00.json', JSON.stringify(envoi));
  await A.sync.synchroniser();
  assert.equal((await A.base.tous('mesures')).length, 1);
  assert.equal((await A.base.tous('seances')).length, 1);
});
test('fichier inbox illisible : ignoré, conservé, signalé', async () => {
  const gh = fauxGithub();
  const A = await appareil(gh);
  gh.ecrireDepuisAilleurs('inbox/mauvais.json', 'pas du json');
  await A.sync.synchroniser();
  assert.equal(gh.fichiers.has('inbox/mauvais.json'), true);
  assert.match(A.sync.etat().dernierEnvoi.erreur, /illisible/);
});
test('accents : aller-retour exact', async () => {
  const gh = fauxGithub();
  const A = await appareil(gh), B = await appareil(gh);
  await A.base.ecrire('aliments', { id: 'perso:1', nom: 'Pâtes complètes à la crème, œuf' });
  await A.sync.synchroniser(); await B.sync.synchroniser();
  assert.equal((await B.base.lire('aliments', 'perso:1')).nom, 'Pâtes complètes à la crème, œuf');
});
test('recevoir sans changement : aucun GET contents', async () => {
  const gh = fauxGithub();
  const A = await appareil(gh);
  await A.base.ecrire('entrees', entree('e1'));
  await A.sync.synchroniser();
  await A.sync.synchroniser();
  const n = gh.appels.length;
  await A.sync.recevoir();
  assert.equal(gh.appels.slice(n).filter(a => a.url.includes('/contents/')).length, 0);
});
test('fichier distant illisible : jamais écrasé', async () => {
  const gh = fauxGithub();
  const A = await appareil(gh);
  gh.ecrireDepuisAilleurs('mesures.json', '{ pas du json');
  await A.base.ecrire('mesures', { id: '2026-11-23', poids: 80 });
  await A.sync.synchroniser();
  assert.equal(gh.lireTexte('mesures.json'), '{ pas du json');
  assert.notEqual(A.sync.etat().erreur, null);
});
