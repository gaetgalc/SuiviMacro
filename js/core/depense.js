// Dépense énergétique : estimation de départ puis adaptative (§ 8.2).
import { ajouterJours, joursEntre, age as ageAu } from './dates.js';
import { tendanceAu } from './tendance.js';
import * as f from './format.js';

export const KCAL_PAR_KG = 7700;
export const FENETRE = 21;
export const JOURS_MIN = 14;
export const PESEES_MIN = 8;
export const SEUIL_JOUR = 1000;
export const FACTEURS = { sedentaire: 1.2, leger: 1.375, modere: 1.55, eleve: 1.725 };

export function metabolismeBase({ sexe, poidsKg, tailleCm, age }) {
  return 10 * poidsKg + 6.25 * tailleCm - 5 * age + (sexe === 'f' ? -161 : 5);
}

export function depenseInitiale(profil, poidsKg, jour) {
  const mb = metabolismeBase({ sexe: profil.sexe, poidsKg, tailleCm: profil.tailleCm, age: ageAu(profil.naissance, jour) });
  return Math.round(mb * (FACTEURS[profil.activite] || FACTEURS.modere));
}

export function jourValide(kcal, statut) {
  if (statut === 'incomplet') return false;
  if (statut === 'complet') return true;
  return kcal >= SEUIL_JOUR;
}

/**
 * apports : Map jour → kcal saisies ; statuts : Map jour → statut ;
 * serie : sortie de serieTendance ; depenseRetenue : dernière dépense validée.
 */
export function estimerDepense({ jour, apports, statuts, serie, depenseRetenue }) {
  const debut = ajouterJours(jour, -(FENETRE - 1));
  const fenetre = joursEntre(debut, jour);
  const valides = fenetre.filter(j => apports.has(j) && jourValide(apports.get(j), statuts.get(j)));
  const pesees = serie.filter(x => x.jour >= debut && x.jour <= jour && x.poids != null && !x.aConfirmer).length;
  const apportsMoyens = valides.length ? valides.reduce((s, j) => s + apports.get(j), 0) / valides.length : null;
  const tFin = tendanceAu(serie, jour);
  const tDebut = tendanceAu(serie, ajouterJours(jour, -FENETRE));
  const deltaKg = tFin != null && tDebut != null ? tFin - tDebut : null;

  const base = { joursValides: valides.length, pesees, apportsMoyens, deltaKg };
  let raison = null;
  if (valides.length < JOURS_MIN) raison = `${valides.length} jours saisis sur ${FENETRE}, il en faut ${JOURS_MIN}.`;
  else if (pesees < PESEES_MIN) raison = `${pesees} pesées sur ${FENETRE} jours, il en faut ${PESEES_MIN}.`;
  else if (deltaKg == null) raison = `Pas encore ${FENETRE} jours de tendance de poids.`;

  if (raison) {
    return {
      ...base, valeur: depenseRetenue, mesuree: null, misAJour: false, raison,
      explication: [`Dépense retenue : ${f.kcal(depenseRetenue)} kcal/j.`, `Pas de mise à jour : ${raison}`],
    };
  }
  const kcalTendance = (deltaKg / FENETRE) * KCAL_PAR_KG;
  const mesuree = apportsMoyens - kcalTendance;
  const valeur = 0.5 * depenseRetenue + 0.5 * mesuree;
  return {
    ...base, valeur, mesuree, misAJour: true, raison: null,
    explication: [
      `Sur les ${FENETRE} derniers jours (${valides.length} saisis) :`,
      `apports moyens : ${f.kcal(apportsMoyens)} kcal/j`,
      `tendance ${f.kg(tDebut)} → ${f.kg(tFin)} kg : ${f.signe(deltaKg, f.kg)} kg ≈ ${f.signe(kcalTendance)} kcal/j`,
      `dépense mesurée : ${f.kcal(apportsMoyens)} ${kcalTendance > 0 ? '−' : '+'} ${f.kcal(Math.abs(kcalTendance))} = ${f.kcal(mesuree)} kcal/j`,
      `Estimation = ½ ancienne (${f.kcal(depenseRetenue)}) + ½ mesurée (${f.kcal(mesuree)}) = ${f.kcal(valeur)} kcal/j`,
    ],
  };
}
