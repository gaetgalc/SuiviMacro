// Tendance de poids : moyenne mobile exponentielle quotidienne (α = 0,1).
import { joursEntre, ecartJours } from './dates.js';

export const ALPHA = 0.1;
export const ECART_ABERRANT = 3;

/**
 * mesures : [{ id: jour, poids?, poidsConfirme? }]
 * → un élément par jour, du premier jour pesé à `jusquA`.
 */
export function serieTendance(mesures, jusquA, alpha = ALPHA) {
  const pesees = new Map(mesures.filter(m => m.poids != null && !m.supprime).map(m => [m.id, m]));
  if (!pesees.size) return [];
  const premier = [...pesees.keys()].sort()[0];
  if (premier > jusquA) return [];
  const res = [];
  let t = null;
  for (const jour of joursEntre(premier, jusquA)) {
    const m = pesees.get(jour);
    const poids = m ? m.poids : null;
    let aConfirmer = false;
    if (poids != null) {
      if (t == null) t = poids;
      else if (Math.abs(poids - t) > ECART_ABERRANT && !m.poidsConfirme) aConfirmer = true;
      else t = t + alpha * (poids - t);
    }
    res.push({ jour, poids, tendance: t, aConfirmer });
  }
  return res;
}

export function tendanceAu(serie, jour) {
  if (!serie.length || jour < serie[0].jour) return null;
  const i = Math.min(ecartJours(serie[0].jour, jour), serie.length - 1);
  return serie[i].tendance;
}

/** Régression linéaire de la tendance sur les n derniers jours (kg/semaine). */
export function pente(serie, jour, n = 14) {
  const pts = serie.filter(x => x.jour <= jour && ecartJours(x.jour, jour) < n);
  if (pts.length < 7) return null;
  const xs = pts.map(p => ecartJours(pts[0].jour, p.jour));
  const ys = pts.map(p => p.tendance);
  const mx = xs.reduce((a, b) => a + b) / xs.length;
  const my = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  const kgSemaine = (num / den) * 7;
  const t = tendanceAu(serie, jour);
  return { kgSemaine, pctSemaine: (kgSemaine / t) * 100 };
}
