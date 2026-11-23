// Générateurs de données fictives déterministes pour les tests.
import { ajouterJours } from '../../js/core/dates.js';

export function alea(graine = 1) {
  let s = graine;
  return () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

/** Mesures fictives : perte linéaire + bruit uniforme ±bruit, jours manquants dans `trous`. */
export function seriePoids({ debut, jours, depart, kgParSemaine = 0, bruit = 0, graine = 1, trous = [] }) {
  const r = alea(graine);
  const res = [];
  for (let i = 0; i < jours; i++) {
    const b = (r() * 2 - 1) * bruit;
    if (trous.includes(i)) continue;
    res.push({ id: ajouterJours(debut, i), poids: Math.round((depart + (kgParSemaine * i) / 7 + b) * 10) / 10 });
  }
  return res;
}
