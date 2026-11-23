import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { ouvrirBase } from '../../js/data/db.js';
import { donneesCalcul, etatAccueil, bilanDuJour } from '../../js/data/vues.js';
import { ajouterJours } from '../../js/core/dates.js';
import { seriePoids } from './series.js';

const jour = '2026-11-23';
async function baseFictive() {
  const b = await ouvrirBase({ nom: 'v', idb: new IDBFactory() });
  await b.ecrire('reglages', { id: 'reglages', profil: { sexe: 'h', naissance: '1990-01-01', tailleCm: 180, activite: 'modere' }, cibles: { kcal: 2100, prot: 120, gluc: 220, lip: 65, fib: 30 }, partGlucides: 0.6, rythmePct: 0.5, depenseRetenue: 2800, jourBilan: 1 });
  await b.ecrirePlusieurs('mesures', seriePoids({ debut: ajouterJours(jour, -29), jours: 30, depart: 82, kgParSemaine: -0.4 }));
  const entrees = [];
  for (let i = 1; i < 30; i++) entrees.push({ id: `e${i}`, jour: ajouterJours(jour, -i), repas: 'dejeuner', heure: '12:00', nom: 'Repas', kcal: 2150, prot: 135, gluc: 215, lip: 68, fib: 25, alimentId: 'skyr', qte: 250, unite: 'g' });
  entrees.push({ id: 'auj', jour, repas: 'petitdej', heure: '08:00', nom: 'Porridge', kcal: 500, prot: 20, gluc: 70, lip: 10, fib: 8 });
  await b.ecrirePlusieurs('entrees', entrees);
  await b.ecrire('aliments', { id: 'skyr', nom: 'Skyr', p100: { kcal: 60, prot: 10, gluc: 4, lip: 0.2, fib: 0 }, portions: [] });
  await b.ecrire('seances', { id: 's1', jour, type: 'Football', dureeMin: 90, kcalActives: 720 });
  return b;
}

test('état de l\'accueil', async () => {
  const b = await baseFictive();
  const d = await donneesCalcul(b, jour);
  const e = etatAccueil(d, jour);
  assert.ok(e.tendance > 79 && e.tendance < 82);
  assert.ok(e.pente.kgSemaine < 0);
  assert.equal(e.depense.misAJour, true);
  assert.ok(e.depense.explication.length >= 4);
  assert.equal(e.totaux.kcal, 500);
  assert.equal(e.restant.kcal, 1600);
  assert.equal(e.restant.prot, 100);
  assert.equal(e.suggestions[0].items[0].aliment.id, 'skyr');
  assert.deepEqual(e.bilanDu, { semaine: '2026-W47' });
  assert.equal(e.seances.length, 1);
  assert.equal(e.parRepas.petitdej.length, 1);
  assert.equal(d.premierJour, ajouterJours(jour, -29));
});
test('accueil sans données', async () => {
  const b = await ouvrirBase({ nom: 'w', idb: new IDBFactory() });
  await b.ecrire('reglages', { id: 'reglages', profil: { sexe: 'h', naissance: '1990-01-01', tailleCm: 180, activite: 'modere' }, cibles: { kcal: 2100, prot: 120, gluc: 220, lip: 65, fib: 30 }, partGlucides: 0.6, rythmePct: 0.5, depenseRetenue: 2800, jourBilan: 1 });
  const e = etatAccueil(await donneesCalcul(b, jour), jour);
  assert.equal(e.tendance, null);
  assert.equal(e.pente, null);
  assert.equal(e.depense.valeur, 2800);
  assert.equal(e.restant.kcal, 2100);
  assert.equal(e.bilanDu, null);
  assert.deepEqual(e.suggestions, []);
});
test('bilanDuJour', async () => {
  const b = await baseFictive();
  const r = await bilanDuJour(b, jour);
  assert.equal(r.totaux.kcal, 500);
});
