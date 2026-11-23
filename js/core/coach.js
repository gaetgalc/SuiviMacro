// Bilan hebdomadaire : nouvelles cibles proposées, avec le calcul (§ 8.3).
import { KCAL_PAR_KG } from './depense.js';
import { tendanceAu } from './tendance.js';
import { semaineIso, lundiDe, ajouterJours, ecartJours, jourSemaine, joursEntre } from './dates.js';
import * as f from './format.js';

export const LIPIDES_MIN_G_KG = 0.6;
export const JOURS_AVANT_BILAN = 14;

export const partGlucidesDepuis = c => (4 * c.gluc) / (4 * c.gluc + 9 * c.lip);

export function proposerCibles({ depense, tendanceKg, reglages, mb }) {
  const prot = reglages.cibles.prot;
  const fib = reglages.cibles.fib ?? 30;
  const kgSemaine = (reglages.rythmePct / 100) * tendanceKg;
  const deficit = Math.round((kgSemaine * KCAL_PAR_KG) / 7);
  let kcal = Math.round((depense - deficit) / 10) * 10;
  const explication = [
    `Dépense estimée : ${f.kcal(depense)} kcal/j.`,
    `Rythme visé : ${f.nombre(reglages.rythmePct, 1)} % de ${f.kg(tendanceKg)} kg = ${f.nombre(kgSemaine, 2)} kg/semaine, soit un déficit de ${f.kcal(deficit)} kcal/j.`,
    `Calories : ${f.kcal(depense)} − ${f.kcal(deficit)} = ${f.kcal(kcal)} kcal/j.`,
  ];
  let plancherKcal = false;
  if (kcal < mb) {
    kcal = Math.round(mb);
    plancherKcal = true;
    explication.push(`Plancher appliqué : jamais sous ton métabolisme de base (${f.kcal(mb)} kcal/j).`);
  }
  const reste = kcal - 4 * prot;
  let gluc = Math.round((reste * reglages.partGlucides) / 4);
  let lip = Math.round((reste * (1 - reglages.partGlucides)) / 9);
  const lipMin = Math.round(LIPIDES_MIN_G_KG * tendanceKg);
  let plancherLipides = false;
  if (lip < lipMin) {
    lip = lipMin;
    gluc = Math.round((reste - 9 * lip) / 4);
    plancherLipides = true;
    explication.push(`Lipides au minimum de ${f.nombre(LIPIDES_MIN_G_KG, 1)} g/kg (${lip} g), pris sur les glucides.`);
  }
  explication.push(
    `Protéines fixes : ${prot} g (${f.kcal(4 * prot)} kcal).`,
    `Le reste (${f.kcal(reste)} kcal) : ${Math.round(reglages.partGlucides * 100)} % glucides → ${gluc} g, ${Math.round((1 - reglages.partGlucides) * 100)} % lipides → ${lip} g.`,
  );
  return { cibles: { kcal, prot, gluc, lip, fib }, deficit, plancherKcal, plancherLipides, explication };
}

/**
 * jourBilan : 1 = lundi … 7 = dimanche. Renvoie la semaine à évaluer, ou null.
 * Le dimanche (jourBilan 7), c'est la semaine qui se termine ; sinon la précédente.
 * Pas de bilan sans pesée : la dépense ne peut pas se mesurer.
 */
export function bilanDu(jour, jourBilan, bilans, premierJourDonnees, aDesPesees = true) {
  if (!aDesPesees || !premierJourDonnees || ecartJours(premierJourDonnees, jour) < JOURS_AVANT_BILAN) return null;
  if (jourSemaine(jour) < jourBilan - 1) return null;
  const semaine = jourBilan === 7 && jourSemaine(jour) === 6 ? semaineIso(jour) : semaineIso(ajouterJours(lundiDe(jour), -7));
  if (bilans.some(b => b.id === semaine && b.decision && !b.supprime)) return null;
  return { semaine };
}

export function bornesSemaine(semaine) {
  const [a, w] = semaine.split('-W').map(Number);
  const jan4 = `${a}-01-04`;
  const lundi = ajouterJours(lundiDe(jan4), (w - 1) * 7);
  return { lundi, dimanche: ajouterJours(lundi, 6) };
}

export function resumeSemaine({ semaine, entrees, serie }) {
  const { lundi, dimanche } = bornesSemaine(semaine);
  const dedans = entrees.filter(e => !e.supprime && e.jour >= lundi && e.jour <= dimanche);
  const parJour = new Map();
  for (const e of dedans) {
    const t = parJour.get(e.jour) || { kcal: 0, prot: 0, fib: 0 };
    t.kcal += e.kcal || 0; t.prot += e.prot || 0; t.fib += e.fib || 0;
    parJour.set(e.jour, t);
  }
  const n = parJour.size;
  const moy = k => (n ? [...parJour.values()].reduce((s, t) => s + t[k], 0) / n : null);
  const tFin = tendanceAu(serie, dimanche), tDebut = tendanceAu(serie, ajouterJours(lundi, -1));
  return {
    lundi, dimanche,
    joursSaisis: n,
    apportsMoyens: moy('kcal'), protMoyennes: moy('prot'), fibMoyennes: moy('fib'),
    deltaTendance: tFin != null && tDebut != null ? tFin - tDebut : null,
    grignotages: dedans.filter(e => e.grignotage).length,
    jours: joursEntre(lundi, dimanche),
  };
}
