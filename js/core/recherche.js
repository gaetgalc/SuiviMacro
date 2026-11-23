// Recherche unifiée d'aliments (§ 9.4). Index = aliments pré-normalisés,
// parcours linéaire (3 500 aliments : quelques millisecondes).
import { simplifier } from './texte.js';
import { classerCiqual } from './proteines.js';

const VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'a', 'au', 'aux', 'et', 'en', 'd', 'l', 'un', 'une', 'ou', 'pour', 'the']);

const singulier = m => (m.length > 3 && /[sx]$/.test(m) ? m.slice(0, -1) : m);

export function normaliser(texte) {
  return simplifier(texte).replace(/[.,/()%]/g, ' ').split(' ').filter(m => m && !VIDES.has(m)).map(singulier);
}

export function ciqualVersAliments(table) {
  return table.lignes.map(([code, nom, ssgrp, kcal, prot, gluc, lip, fib]) => ({
    id: `ciqual:${code}`, source: 'ciqual', ref: String(code), nom, ssgrp,
    p100: { kcal, prot, gluc, lip, fib }, portions: [], origineProt: classerCiqual(nom, ssgrp),
  }));
}

function preparer(aliment) {
  const tete = normaliser(String(aliment.nom).split(',')[0]);
  const texte = `${aliment.nom} ${aliment.marque || ''} ${(aliment.synonymes || []).join(' ')}`;
  const mots = normaliser(texte);
  const bruts = new Set(simplifier(texte).replace(/[.,/()%]/g, ' ').split(' '));
  // Régime végétarien : viandes et poissons Ciqual relégués (sous-groupes 0401-0409).
  const carne = aliment.source === 'ciqual' && /^040[1-9]$/.test(aliment.ssgrp || '');
  return { aliment, mots, tete, bruts, carne };
}

export function creerIndex(aliments) {
  return { entrees: new Map(aliments.map(a => [a.id, preparer(a)])) };
}

export function ajouterAIndex(index, aliment) {
  index.entrees.set(aliment.id, preparer(aliment));
}

export function retirerDeIndex(index, id) {
  index.entrees.delete(id);
}

const BONUS_SOURCE = { perso: 15, recette: 20, plat: 5, ciqual: 0, off: 0 };

export function chercher(index, requete, { usages = new Map(), limite = 30, bonus = {} } = {}) {
  const q = normaliser(requete);
  if (!q.length) return [];
  const qBruts = simplifier(requete).split(' ');
  const res = [];
  for (const { aliment, mots, tete, bruts, carne } of index.entrees.values()) {
    if (aliment.supprime) continue;
    let score = 100;
    let ok = true;
    for (const [i, m] of q.entries()) {
      const pos = mots.findIndex(x => x.startsWith(m));
      if (pos < 0) { ok = false; break; }
      if (mots[pos] === m) score += 10;
      if (tete.includes(mots[pos])) score += 12;
      if (i === 0 && pos === 0) score += 30;
    }
    if (!ok) continue;
    for (const b of qBruts) if (bruts.has(b)) score += 4;
    if (carne) score -= 40;
    score -= Math.max(0, mots.length - q.length) * 2;
    score += (BONUS_SOURCE[aliment.source] || 0) + (bonus[aliment.source] || 0);
    if (aliment.favori) score += 30;
    const u = usages.get(aliment.id);
    if (u?.n) score += 25 * Math.log2(1 + u.n);
    res.push({ aliment, score });
  }
  res.sort((a, b) => b.score - a.score || a.aliment.nom.length - b.aliment.nom.length);
  return res.slice(0, limite);
}
