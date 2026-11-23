// Open Food Facts : fiche produit et recherche (§ 9.2). Données sous licence ODbL.
import { classerOff } from '../core/proteines.js';
import { kcalDepuisMacros } from '../core/nutrition.js';

const CHAMPS = 'code,product_name,product_name_fr,brands,quantity,serving_size,serving_quantity,categories_tags,nutriments';
const DUREE_CACHE = 30 * 86400000;
const n = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function versAliment(p) {
  const nu = p?.nutriments || {};
  const prot = n(nu.proteins_100g), gluc = n(nu.carbohydrates_100g), lip = n(nu.fat_100g);
  let kcal = n(nu['energy-kcal_100g']);
  if (kcal == null && n(nu.energy_100g) != null) kcal = Math.round((n(nu.energy_100g) / 4.184) * 10) / 10;
  if (kcal == null && (prot != null || gluc != null || lip != null)) kcal = kcalDepuisMacros(prot, gluc, lip);
  const nom = String(p?.product_name_fr || p?.product_name || '').trim() || `Produit ${p?.code}`;
  const marque = Array.isArray(p?.brands) ? p.brands.join(', ') : String(p?.brands || '').split(',').map(s => s.trim()).filter(Boolean).join(', ');
  if (kcal == null) return { incomplet: true, code: String(p?.code || ''), nom, marque, brut: p };
  const portion = n(p.serving_quantity);
  return {
    id: `off:${p.code}`, source: 'off', ref: String(p.code), nom, marque: marque || undefined,
    p100: { kcal, prot: prot ?? 0, gluc: gluc ?? 0, lip: lip ?? 0, fib: n(nu.fiber_100g) },
    portions: portion > 0 ? [{ id: 'portion', nom: `portion (${portion} g)`, g: portion }] : [],
    origineProt: classerOff(nom, p.categories_tags || []),
  };
}

export function creerOff({ fetch = globalThis.fetch.bind(globalThis), base, maintenant = () => Date.now() }) {
  async function enCache(cle, calcul) {
    const c = base && (await base.cache(cle));
    if (c && maintenant() - c.le < DUREE_CACHE) return c.valeur;
    const v = await calcul();
    if (base && v !== undefined) await base.poserCache(cle, v, maintenant());
    return v;
  }
  return {
    async produit(code) {
      const propre = String(code).replace(/\D/g, '');
      if (!propre) return null;
      return enCache(`off:p:${propre}`, async () => {
        const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${propre}.json?fields=${CHAMPS}`);
        if (!r.ok) return null;
        const j = await r.json();
        return j.status === 1 && j.product ? versAliment({ ...j.product, code: j.product.code || propre }) : null;
      });
    },
    async chercher(q, { signal } = {}) {
      const t = String(q).trim().toLowerCase();
      if (t.length < 3) return [];
      return enCache(`off:q:${t}`, async () => {
        const u = new URL('https://search.openfoodfacts.org/search');
        u.search = new URLSearchParams({ q: t, langs: 'fr', page_size: '20', fields: 'code,product_name,product_name_fr,brands,nutriments,categories_tags,serving_quantity' }).toString();
        const r = await fetch(u.toString(), { signal });
        if (!r.ok) throw new Error(`Open Food Facts : HTTP ${r.status}`);
        const j = await r.json();
        return (j.hits || []).map(versAliment).filter(a => !a.incomplet);
      });
    },
  };
}
