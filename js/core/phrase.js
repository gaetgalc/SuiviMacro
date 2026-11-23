// Saisie en phrase libre, sans IA (§ 10.4).
import { chercher, normaliser } from './recherche.js';
import { simplifier } from './texte.js';
import { lireQuantite } from './nutrition.js';
import { ORIGINES } from './proteines.js';

export function platsVersAliments(plats) {
  return plats.map(p => ({
    id: `plat:${p.id}`, source: 'plat', ref: p.id, nom: p.nom, synonymes: p.synonymes,
    p100: p.p100, portions: p.portions, origineProt: p.origineProt, estimation: p.estimation,
  }));
}

/** Portions de l'aliment, puis portions usuelles de la table qui correspondent à son nom. */
export function portionsPour(aliment, table = []) {
  const mots = normaliser(aliment.nom);
  let meilleure = null;
  for (const e of table) {
    const cle = normaliser(e.cle);
    if (cle[0] !== mots[0] || !cle.every(m => mots.includes(m))) continue;
    if (!meilleure || cle.length > meilleure.n) meilleure = { n: cle.length, portions: e.portions };
  }
  const res = [...(aliment.portions || [])];
  for (const p of meilleure?.portions || []) if (!res.some(x => x.id === p.id)) res.push(p);
  return res;
}

const NOMBRES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, demi: 0.5, demie: 0.5, moitie: 0.5, quart: 0.25 };
const TAILLES = [['tres grosse', 1.6], ['tres gros', 1.6], ['tres grande', 1.6], ['tres grand', 1.6], ['grosse', 1.3], ['gros', 1.3], ['grande', 1.3], ['grand', 1.3], ['petite', 0.7], ['petit', 0.7], ['normale', 1], ['normal', 1], ['moyenne', 1], ['moyen', 1]];
const UNITES = ['bol', 'tranche', 'pot', 'verre', 'part', 'assiette', 'piece', 'dose', 'poignee', 'cuillere', 'portion', 'boule', 'shaker', 'carre', 'gourde', 'bloc', 'morceau'];
const VIDES_PHRASE = new Set(['de', 'd', 'du', 'des', 'la', 'le', 'les', 'l', 'a', 'au', 'aux', 'en', 'mon', 'ma', 'mes', 'avec']);

function lireSegment(brut) {
  let t = ` ${simplifier(brut).replace(/(\d),(\d)/g, '$1.$2').replace(/,/g, ' ')} `;
  let qte = null, unite = null, facteur = 1, uniteMot = null;
  const grammes = t.match(/ (\d+(?:\.\d+)?)\s*(kg|g|gr|grammes?|ml|cl|l) /);
  if (grammes) {
    const n = Number(grammes[1]);
    const mult = { kg: 1000, cl: 10, l: 1000 }[grammes[2]] || 1;
    qte = n * mult; unite = grammes[2] === 'ml' || grammes[2] === 'cl' || grammes[2] === 'l' ? 'ml' : 'g';
    t = t.replace(grammes[0], ' ');
  }
  const fois = t.match(/ x\s?(\d+) /);
  if (fois) { qte = (qte || 1) * Number(fois[1]); t = t.replace(fois[0], ' '); }
  if (qte == null) {
    const n = t.match(/ (\d+(?:[.,]\d+)?(?:\/\d+)?) /);
    if (n) { qte = lireQuantite(n[1]); t = t.replace(n[0], ' '); }
  }
  for (const [mot, f] of TAILLES) {
    if (t.includes(` ${mot} `)) { facteur = f; t = t.replace(` ${mot} `, ' '); break; }
  }
  const mots = t.split(' ').filter(Boolean).filter(m => {
    const s = m.replace(/[sx]$/, '');
    if (s in NOMBRES || m in NOMBRES) {
      const v = NOMBRES[m] ?? NOMBRES[s];
      if (v < 1) qte = qte == null || qte === 1 ? v : qte * v; // « un demi » = 0,5 ; « deux demi » = 1
      else if (qte == null) qte = v;
      return false;
    }
    if (UNITES.includes(s)) { uniteMot = uniteMot || s; return false; }
    return !VIDES_PHRASE.has(m);
  });
  return { qte, unite, facteur, uniteMot, requete: mots.join(' ') };
}

function trouver(index, requete) {
  const mots = requete.split(' ').filter(Boolean);
  for (let n = mots.length; n >= 1; n--) {
    const r = chercher(index, mots.slice(0, n).join(' '), { limite: 4 });
    if (r.length) return { choix: r.map(x => x.aliment), confiance: n / mots.length };
  }
  return { choix: [], confiance: 0 };
}

export function analyserPhrase(texte, index, tablePortions = []) {
  // Une virgule entre deux chiffres est décimale (« 1,5 bol ») : elle ne sépare pas.
  const segments = String(texte).split(/\s*(?:,(?!\d)|(?<!\d),|;|\+|\bet\b|\bavec\b)\s*/i).filter(s => s && s.trim());
  const lignes = [];
  for (const brut of segments) {
    const s = lireSegment(brut);
    if (!s.requete && lignes.length) {
      const prec = lignes[lignes.length - 1];
      if (s.facteur !== 1) prec.facteur = s.facteur;
      if (s.qte != null) prec.qte = s.qte;
      prec.segment += `, ${brut.trim()}`;
      continue;
    }
    if (!s.requete) continue;
    const { choix, confiance } = trouver(index, s.requete);
    const avecPortions = choix.map(a => ({ ...a, portions: portionsPour(a, tablePortions) }));
    let { qte, unite } = s;
    if (!unite) {
      const portions = avecPortions[0]?.portions || [];
      const p = portions.find(x => x.id === s.uniteMot || simplifier(x.nom).includes(s.uniteMot || '\u0000')) || portions[0];
      if (p) unite = p.id;
      else { unite = 'g'; qte = (qte ?? 1) * 100; }
    }
    lignes.push({ segment: brut.trim(), qte: qte ?? 1, unite, facteur: s.facteur, choix: avecPortions, confiance });
  }
  return lignes;
}

/** Ligne → ce qu'il faut ajouter au journal (facteur de taille appliqué). */
export function resoudre(ligne, aliment = ligne.choix[0]) {
  return { aliment, qte: Math.round(ligne.qte * ligne.facteur * 100) / 100, unite: ligne.unite };
}

export function consigneClaude(texte) {
  return [
    'Estime les valeurs nutritionnelles de ce que j\'ai mangé :',
    `« ${texte} »`,
    '',
    'Réponds uniquement par un bloc JSON de cette forme, une ligne par aliment, quantités en grammes et valeurs pour la quantité indiquée :',
    '{ "aliments": [ { "nom": "…", "g": 0, "kcal": 0, "prot": 0, "gluc": 0, "lip": 0, "fib": 0, "origineProt": "legumineuses|soja|cereales|laitiers|oleagineux|autres" } ] }',
    'Je suis végétarien ; en cas de doute sur une portion de restaurant, prends une portion standard en France.',
  ].join('\n');
}

export function extraireJson(texte) {
  const t = String(texte || '');
  const bloc = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidats = bloc ? [bloc[1]] : [];
  for (let i = t.indexOf('{'); i >= 0; i = t.indexOf('{', i + 1)) {
    for (let j = t.lastIndexOf('}'); j > i; j = t.lastIndexOf('}', j - 1)) candidats.push(t.slice(i, j + 1));
  }
  for (const c of candidats) {
    try { const o = JSON.parse(c); if (o && typeof o === 'object') return o; } catch { /* suivant */ }
  }
  return null;
}

const num = v => (typeof v === 'number' ? v : lireQuantite(v));

export function lignesDepuisJson(obj, mode = 'ia') {
  const res = [];
  (obj?.aliments || []).forEach((a, i) => {
    const g = num(a.g), kcal = num(a.kcal);
    if (!a.nom || !(g > 0) || kcal == null) return;
    const p = v => ((num(v) ?? 0) / g) * 100;
    const aliment = {
      id: `${mode}:${Date.now().toString(36)}${i}`, source: mode, nom: String(a.nom),
      p100: { kcal: (kcal / g) * 100, prot: p(a.prot), gluc: p(a.gluc), lip: p(a.lip), fib: a.fib == null ? null : p(a.fib) },
      portions: [], origineProt: ORIGINES.includes(a.origineProt) ? a.origineProt : 'autres',
    };
    res.push({ segment: aliment.nom, qte: g, unite: 'g', facteur: 1, choix: [aliment], confiance: 1 });
  });
  return res;
}
