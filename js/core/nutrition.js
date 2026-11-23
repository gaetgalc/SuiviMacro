// Valeurs nutritionnelles. p100 = pour 100 g ; fib peut être null (inconnu).

export const CLES = ['kcal', 'prot', 'gluc', 'lip', 'fib'];

/** Nombre tapé à la française : « 1,5 », « 1/2 ». Vide, négatif ou illisible → null. */
export function lireQuantite(texte) {
  if (texte == null) return null;
  const t = String(texte).trim().replace(',', '.');
  if (!t) return null;
  const frac = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  const n = frac ? Number(frac[1]) / Number(frac[2]) : (/^\d*\.?\d+$/.test(t) ? Number(t) : NaN);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function grammes(aliment, qte, unite) {
  if (unite === 'g' || unite === 'ml') return qte;
  const p = (aliment.portions || []).find(x => x.id === unite);
  if (!p) throw new Error(`Portion inconnue : ${unite}`);
  return qte * p.g;
}

export function valeurs(aliment, qte, unite) {
  const g = grammes(aliment, qte, unite);
  const v = { g };
  for (const k of CLES) {
    const x = aliment.p100?.[k];
    v[k] = x == null ? (k === 'fib' ? null : 0) : (x * g) / 100;
  }
  return v;
}

export function somme(entrees) {
  const t = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 };
  for (const e of entrees) {
    if (e.supprime) continue;
    for (const k of CLES) t[k] += e[k] || 0;
  }
  return t;
}

export function restant(cibles, totaux) {
  const r = {};
  for (const k of CLES) r[k] = (cibles[k] || 0) - (totaux[k] || 0);
  return r;
}

export function p100Recette(ingredients, poidsCuitG) {
  const total = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 };
  let poids = 0;
  for (const { aliment, g } of ingredients) {
    const v = valeurs(aliment, g, 'g');
    poids += g;
    for (const k of CLES) total[k] += v[k] || 0;
  }
  const div = (poidsCuitG || poids) / 100;
  const r = {};
  for (const k of CLES) r[k] = div ? total[k] / div : 0;
  return r;
}

export const kcalDepuisMacros = (prot, gluc, lip) => 4 * (prot || 0) + 4 * (gluc || 0) + 9 * (lip || 0);
