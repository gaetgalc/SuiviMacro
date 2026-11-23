import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerDepot, encoder, decoder, ConflitDepot, JetonRefuse, HorsLigne } from '../../js/data/depot.js';
import { fauxGithub } from './faux-github.js';

test('base64 UTF-8 aller-retour', () => {
  const t = 'Pâtes complètes, crème, œuf — 1 234,5 kcal';
  assert.equal(decoder(encoder(t)), t);
  assert.equal(decoder(encoder(t).replace(/(.{10})/g, '$1\n')), t);
});
test('écrire, lire, arbre', async () => {
  const gh = fauxGithub();
  const d = creerDepot({ jeton: 'jeton-fictif', fetch: gh.fetch });
  assert.equal((await d.arbre()).size, 0);
  assert.equal(await d.lire('mesures.json'), null);
  const sha = await d.ecrire('mesures.json', '{"a":"é"}');
  assert.deepEqual(await d.lire('mesures.json'), { texte: '{"a":"é"}', sha });
  assert.equal((await d.arbre()).get('mesures.json'), sha);
  const h = gh.appels.at(-1).entetes;
  assert.equal(h.Authorization, 'Bearer jeton-fictif');
  assert.equal(h.Accept, 'application/vnd.github+json');
});
test('sha périmé → ConflitDepot', async () => {
  const gh = fauxGithub();
  const d = creerDepot({ jeton: 'jeton-fictif', fetch: gh.fetch });
  await d.ecrire('a.json', '1');
  await assert.rejects(d.ecrire('a.json', '2', 'mauvais'), ConflitDepot);
  await assert.rejects(d.ecrire('a.json', '2'), ConflitDepot);
});
test('mauvais jeton → JetonRefuse', async () => {
  const d = creerDepot({ jeton: 'faux', fetch: fauxGithub().fetch });
  await assert.rejects(d.lire('a.json'), JetonRefuse);
  assert.deepEqual(await d.tester(), { ok: false, message: 'Jeton refusé par GitHub (expiré ou sans accès au dépôt).' });
});
test('réseau absent → HorsLigne', async () => {
  const d = creerDepot({ jeton: 'x', fetch: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(d.arbre(), HorsLigne);
});
test('supprimer et tester', async () => {
  const gh = fauxGithub();
  const d = creerDepot({ jeton: 'jeton-fictif', fetch: gh.fetch });
  const sha = await d.ecrire('inbox/x.json', '{}');
  await d.supprimer('inbox/x.json', sha);
  assert.equal(gh.fichiers.size, 0);
  assert.equal((await d.tester()).ok, true);
});
test('fichier de plus de 1 Mo : lu par l\'API des blobs', async () => {
  const gh = fauxGithub();
  gh.ecrireDepuisAilleurs('aliments.json', '{"version":1,"aliments":[{"id":"gros","nom":"Pâte"}]}');
  gh.simulerGrosFichier('aliments.json');
  const d = creerDepot({ jeton: 'jeton-fictif', fetch: gh.fetch });
  const f = await d.lire('aliments.json');
  assert.equal(JSON.parse(f.texte).aliments[0].nom, 'Pâte');
});
