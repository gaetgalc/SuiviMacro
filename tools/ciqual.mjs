// Table Ciqual 2025 (ANSES, CC-BY 4.0) → data/ciqual.json.
// Source : Zenodo, enregistrement 17550133 (concept 17550132), fichiers du 03/11/2025.
// Usage : npm run ciqual   (télécharge dans tools/cache/, ignoré par Git)
import { createReadStream, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const BASE = 'https://zenodo.org/api/records/17550133/files';
const FICHIERS = { alim: 'alim_2025_11_03.xml', grp: 'alim_grp_2025_11_03.xml', compo: 'compo_2025_11_03.xml' };
const CONST = { 328: 'kcal', 25000: 'prot', 31000: 'gluc', 40000: 'lip', 34100: 'fib' };
const CACHE = new URL('./cache/', import.meta.url);

const entites = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** Teneur Ciqual : « 12,5 », « traces », « < 0,5 », « - ». */
export function lireTeneur(texte) {
  if (texte == null) return null;
  const t = entites(String(texte)).trim();
  if (!t || t === '-') return null;
  if (t.toLowerCase() === 'traces') return 0;
  const inf = t.match(/^<\s*([\d,.]+)$/);
  if (inf) return Number(inf[1].replace(',', '.')) / 2;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function telecharger(nom) {
  const dest = new URL(nom, CACHE);
  if (existsSync(dest) && statSync(dest).size > 0) return dest;
  mkdirSync(CACHE, { recursive: true });
  const r = await fetch(`${BASE}/${nom}/content`);
  if (!r.ok) throw new Error(`${nom} : HTTP ${r.status}`);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

async function* blocs(fichier, balise) {
  const lignes = createInterface({ input: createReadStream(fichier, 'utf8'), crlfDelay: Infinity });
  let courant = null;
  for await (const l of lignes) {
    if (l.includes(`<${balise}>`)) courant = {};
    else if (l.includes(`</${balise}>`)) { yield courant; courant = null; }
    else if (courant) {
      const m = l.match(/<(\w+)>(.*)<\/\1>/);
      if (m) courant[m[1]] = entites(m[2]).trim();
    }
  }
}

async function construire() {
  const f = {};
  for (const [k, nom] of Object.entries(FICHIERS)) f[k] = await telecharger(nom);
  const aliments = new Map();
  for await (const a of blocs(f.alim, 'ALIM')) {
    aliments.set(a.alim_code, { code: a.alim_code, nom: a.alim_nom_fr, ssgrp: a.alim_ssgrp_code, kcal: null, prot: null, gluc: null, lip: null, fib: null });
  }
  for await (const c of blocs(f.compo, 'COMPO')) {
    const cle = CONST[c.const_code];
    const a = cle && aliments.get(c.alim_code);
    if (a) a[cle] = lireTeneur(c.teneur);
  }
  const arrondi = x => (x == null ? null : Math.round(x * 10) / 10);
  const lignes = [...aliments.values()]
    .filter(a => a.kcal != null && a.nom)
    .map(a => [Number(a.code), a.nom, a.ssgrp, arrondi(a.kcal), arrondi(a.prot ?? 0), arrondi(a.gluc ?? 0), arrondi(a.lip ?? 0), arrondi(a.fib)]);
  const sortie = {
    version: 'Ciqual 2025 (03/11/2025)', licence: 'CC-BY 4.0', source: 'ANSES, Table de composition nutritionnelle des aliments Ciqual',
    colonnes: ['code', 'nom', 'ssgrp', 'kcal', 'prot', 'gluc', 'lip', 'fib'], lignes,
  };
  writeFileSync(new URL('../data/ciqual.json', import.meta.url), JSON.stringify(sortie));
  console.log(`${lignes.length} aliments écrits (${aliments.size - lignes.length} sans énergie écartés).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await construire();
