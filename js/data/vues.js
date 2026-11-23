// Assemble les données de la base pour les écrans (calculs dans js/core).
import { somme, restant } from '../core/nutrition.js';
import { serieTendance, tendanceAu, pente } from '../core/tendance.js';
import { estimerDepense } from '../core/depense.js';
import { bilanDu } from '../core/coach.js';
import { habituels, suggerer } from '../core/suggestions.js';
import { ajouterJours } from '../core/dates.js';

export const REPAS = ['petitdej', 'dejeuner', 'collation', 'diner'];

export async function bilanDuJour(base, jour) {
  const reglages = await base.lire('reglages', 'reglages');
  const entrees = await base.parIndex('entrees', 'jour', jour);
  const totaux = somme(entrees);
  return { reglages, entrees, totaux, cibles: reglages.cibles, restant: restant(reglages.cibles, totaux) };
}

export async function donneesCalcul(base, jour) {
  const [reglages, entrees, mesures, jours, seances, bilans, aliments] = await Promise.all([
    base.lire('reglages', 'reglages'), base.tous('entrees'), base.tous('mesures'), base.tous('jours'),
    base.tous('seances'), base.tous('bilans'), base.tous('aliments'),
  ]);
  const apports = new Map();
  for (const e of entrees) apports.set(e.jour, (apports.get(e.jour) || 0) + (e.kcal || 0));
  const statuts = new Map(jours.map(j => [j.id, j.statut]));
  const premiers = [...entrees.map(e => e.jour), ...mesures.filter(m => m.poids != null).map(m => m.id)].sort();
  return {
    reglages, entrees, mesures, jours, seances, bilans,
    aliments: new Map(aliments.map(a => [a.id, a])),
    serie: serieTendance(mesures, jour), apports, statuts, premierJour: premiers[0] || null,
  };
}

export function etatAccueil(d, jour) {
  const duJour = d.entrees.filter(e => e.jour === jour);
  const totaux = somme(duJour);
  const cibles = d.reglages.cibles;
  const r = restant(cibles, totaux);
  const parRepas = Object.fromEntries(REPAS.map(k => [k, duJour.filter(e => e.repas === k).sort((a, b) => (a.heure || '').localeCompare(b.heure || ''))]));
  const peseeDuJour = d.serie.find(x => x.jour === jour);
  return {
    tendance: tendanceAu(d.serie, jour),
    pente: pente(d.serie, jour),
    serie: d.serie,
    depense: estimerDepense({ jour, apports: d.apports, statuts: d.statuts, serie: d.serie, depenseRetenue: d.reglages.depenseRetenue }),
    totaux, cibles, restant: r, parRepas,
    suggestions: suggerer({ restant: r, habituels: habituels(d.entrees, d.aliments, jour) }),
    bilanDu: bilanDu(jour, d.reglages.jourBilan || 1, d.bilans, d.premierJour, d.serie.length > 0),
    seances: d.seances.filter(s => s.jour === jour),
    aConfirmer: d.serie.filter(x => x.aConfirmer && x.jour >= ajouterJours(jour, -13)).map(x => ({ jour: x.jour, poids: x.poids })),
    peseeDuJour: peseeDuJour?.poids ?? null,
  };
}
