import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metabolismeBase, jourValide, estimerDepense, depenseInitiale, FACTEURS } from '../../js/core/depense.js';
import { serieTendance, tendanceAu } from '../../js/core/tendance.js';
import { ajouterJours } from '../../js/core/dates.js';
import { seriePoids } from './series.js';

test('Mifflin-St Jeor', () => {
  assert.equal(metabolismeBase({ sexe: 'h', poidsKg: 80, tailleCm: 180, age: 30 }), 1780);
  assert.equal(metabolismeBase({ sexe: 'f', poidsKg: 60, tailleCm: 165, age: 30 }), 1320.25);
});
test('dépense initiale', () => {
  assert.equal(FACTEURS.modere, 1.55);
  assert.equal(depenseInitiale({ sexe: 'h', tailleCm: 180, naissance: '1996-01-01', activite: 'modere' }, 80, '2026-11-23'), Math.round(1780 * 1.55));
});
test('journée valide', () => {
  assert.equal(jourValide(999, 'auto'), false);
  assert.equal(jourValide(1000, 'auto'), true);
  assert.equal(jourValide(600, 'complet'), true);
  assert.equal(jourValide(2500, 'incomplet'), false);
  assert.equal(jourValide(1500, undefined), true);
});

// 40 jours de pesées, perte linéaire.
const jour = '2026-11-23';
const debut = ajouterJours(jour, -39);
const mesures = seriePoids({ debut, jours: 40, depart: 82, kgParSemaine: -0.3 });
const serie = serieTendance(mesures, jour);
const apports = n => new Map(Array.from({ length: n }, (_, i) => [ajouterJours(jour, -i), 2200]));

test('dépense mesurée et mise à jour moitié-moitié', () => {
  const r = estimerDepense({ jour, apports: apports(21), statuts: new Map(), serie, depenseRetenue: 2600 });
  const delta = tendanceAu(serie, jour) - tendanceAu(serie, ajouterJours(jour, -21));
  const mesuree = 2200 - (delta / 21) * 7700;
  assert.ok(Math.abs(r.mesuree - mesuree) < 1);
  assert.equal(r.misAJour, true);
  assert.ok(Math.abs(r.valeur - (0.5 * 2600 + 0.5 * mesuree)) < 1);
  assert.equal(r.joursValides, 21);
  assert.equal(r.raison, null);
  const texte = r.explication.join('\n');
  assert.match(texte, /apports moyens/i);
  assert.match(texte, /tendance/i);
  assert.match(texte, /dépense mesurée/i);
  assert.match(texte, /½/);
});
test('moins de 14 jours valides : pas de mise à jour', () => {
  const r = estimerDepense({ jour, apports: apports(13), statuts: new Map(), serie, depenseRetenue: 2600 });
  assert.equal(r.misAJour, false);
  assert.equal(r.valeur, 2600);
  assert.match(r.raison, /13/);
  assert.match(r.raison, /14/);
});
test('moins de 8 pesées : pas de mise à jour', () => {
  const peu = serieTendance(mesures.filter((m, i) => i < 19 || i % 4 === 0), jour);
  const r = estimerDepense({ jour, apports: apports(21), statuts: new Map(), serie: peu, depenseRetenue: 2600 });
  assert.equal(r.misAJour, false);
  assert.match(r.raison, /pesée/);
});
test('jours non saisis non comptés comme zéro, journées incomplètes exclues', () => {
  const a = apports(21);
  for (let i = 0; i < 5; i++) a.delete(ajouterJours(jour, -i * 2));
  a.set(ajouterJours(jour, -1), 500);
  const statuts = new Map([[ajouterJours(jour, -3), 'incomplet']]);
  const r = estimerDepense({ jour, apports: a, statuts, serie, depenseRetenue: 2600 });
  assert.equal(r.apportsMoyens, 2200);
  assert.equal(r.joursValides, 14);
});
