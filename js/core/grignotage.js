// Comprendre ses grignotages (§ 11).
import { ajouterJours } from './dates.js';
import { kcal as fKcal } from './format.js';

export const RAISONS = ['faim', 'ennui', 'stress', 'fatigue', 'social', 'envie', 'autre'];
const CRENEAUX = Array.from({ length: 12 }, (_, i) => `${i * 2}-${i * 2 + 2}`);

function sur(entrees, debut, fin) {
  return entrees.filter(e => !e.supprime && e.jour >= debut && e.jour <= fin);
}

export function statsGrignotage(entrees, jourFin, nbJours) {
  const debut = ajouterJours(jourFin, -(nbJours - 1));
  const periode = sur(entrees, debut, jourFin);
  const g = periode.filter(e => e.grignotage);
  const total = periode.reduce((s, e) => s + (e.kcal || 0), 0);
  const kcal = g.reduce((s, e) => s + (e.kcal || 0), 0);
  const parCreneau = Object.fromEntries(CRENEAUX.map(c => [c, 0]));
  const parRaison = Object.fromEntries(RAISONS.map(r => [r, 0]));
  const noms = new Map();
  for (const e of g) {
    const h = Number((e.heure || '0').split(':')[0]);
    parCreneau[CRENEAUX[Math.floor(h / 2)]]++;
    parRaison[RAISONS.includes(e.grignotage.raison) ? e.grignotage.raison : 'autre']++;
    noms.set(e.nom, (noms.get(e.nom) || 0) + 1);
  }
  const avant = sur(entrees, ajouterJours(debut, -nbJours), ajouterJours(debut, -1)).filter(e => e.grignotage);
  return {
    nombre: g.length, kcal, part: total ? kcal / total : 0, parCreneau, parRaison,
    topAliments: [...noms].map(([nom, n]) => ({ nom, n })).sort((a, b) => b.n - a.n).slice(0, 5),
    semainePrecedente: { nombre: avant.length, kcal: avant.reduce((s, e) => s + (e.kcal || 0), 0) },
  };
}

const max = obj => Object.entries(obj).sort((a, b) => b[1] - a[1])[0];

export function phraseGrignotage(s) {
  if (!s.nombre) return 'Aucun grignotage noté sur la période';
  const [creneau] = max(s.parCreneau);
  const [raison] = max(s.parRaison);
  const [a, b] = creneau.split('-');
  return `${s.nombre} grignotage${s.nombre > 1 ? 's' : ''} (${fKcal(s.kcal)} kcal), surtout entre ${a} h et ${b} h ; raison la plus fréquente : ${raison}`;
}
