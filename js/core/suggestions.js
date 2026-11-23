// Habituels et suggestions pour combler le restant (§ 11), sans IA.
import { ajouterJours } from './dates.js';
import { valeurs } from './nutrition.js';

export const PROT_MIN = 20;

/** aliments : Map id → aliment. Quantité = celle de la dernière entrée. */
export function habituels(entrees, aliments, jour, repas) {
  const debut = ajouterJours(jour, -29);
  const parAliment = new Map();
  for (const e of entrees) {
    if (e.supprime || !e.alimentId || e.jour < debut || e.jour > jour) continue;
    if (repas && e.repas !== repas) continue;
    const a = aliments.get(e.alimentId);
    if (!a || a.supprime) continue;
    const cle = `${e.jour}T${e.heure || ''}`;
    const h = parAliment.get(a.id);
    if (!h) parAliment.set(a.id, { aliment: a, qte: e.qte, unite: e.unite, n: 1, cle });
    else {
      h.n++;
      if (cle > h.cle) Object.assign(h, { qte: e.qte, unite: e.unite, cle });
    }
  }
  return [...parAliment.values()].sort((x, y) => y.n - x.n || (y.cle > x.cle ? 1 : -1)).map(({ cle, ...h }) => h);
}

export function suggerer({ restant, habituels: liste }) {
  if (!(restant.prot >= PROT_MIN)) return [];
  const max = Math.max(0, restant.kcal) * 1.1;
  const cands = liste.slice(0, 20).map(h => ({ h, v: valeurs(h.aliment, h.qte, h.unite) }));
  const combos = [];
  for (let i = 0; i < cands.length; i++) {
    combos.push([cands[i]]);
    for (let j = i + 1; j < cands.length; j++) combos.push([cands[i], cands[j]]);
  }
  return combos
    .map(c => ({
      items: c.map(x => ({ aliment: x.h.aliment, qte: x.h.qte, unite: x.h.unite })),
      prot: c.reduce((s, x) => s + x.v.prot, 0), kcal: c.reduce((s, x) => s + x.v.kcal, 0),
      n: c.reduce((s, x) => s + x.h.n, 0),
    }))
    .filter(c => c.kcal <= max && c.prot > 0)
    .sort((a, b) => Math.min(b.prot, restant.prot) - Math.min(a.prot, restant.prot)
      || Math.abs(restant.kcal - a.kcal) - Math.abs(restant.kcal - b.kcal) || b.n - a.n)
    .slice(0, 3)
    .map(({ n, ...c }) => c);
}
