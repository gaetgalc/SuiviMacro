// Outils de bout en bout : serveur, Chromium en iPhone 13, réseau externe simulé.
import { createRequire } from 'node:module';
import { demarrerServeur } from '../../tools/serveur.mjs';
import { fauxGithub } from '../unit/faux-github.js';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT,POST,DELETE,OPTIONS' };

export const PRODUIT_TEST = {
  code: '3017620422003', product_name: 'Tofu ferme fumé', brands: 'Marque Test', serving_quantity: 100, categories_tags: ['en:tofu'],
  nutriments: { 'energy-kcal_100g': 150, proteins_100g: 16, carbohydrates_100g: 2, fat_100g: 9, fiber_100g: 2 },
};

export async function fauxReseau(contexte, { gh = fauxGithub(), produits = [PRODUIT_TEST], anthropic = null } = {}) {
  await contexte.route('https://api.github.com/**', async route => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const h = r.headers();
    const rep = await gh.fetch(r.url(), { method: r.method(), headers: { Authorization: h.authorization }, body: r.postData() || undefined });
    return route.fulfill({ status: rep.status, headers: { ...CORS, 'content-type': 'application/json' }, body: await rep.text() });
  });
  await contexte.route(/openfoodfacts\.org/, async route => {
    const u = new URL(route.request().url());
    if (u.hostname.startsWith('search.')) {
      const q = (u.searchParams.get('q') || '').toLowerCase();
      const hits = produits.filter(p => p.product_name.toLowerCase().includes(q.split(' ')[0]));
      return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ hits }) });
    }
    const code = u.pathname.match(/product\/(\d+)/)?.[1];
    const p = produits.find(x => x.code === code);
    return route.fulfill({ status: p ? 200 : 404, headers: CORS, contentType: 'application/json', body: JSON.stringify(p ? { status: 1, product: p } : { status: 0 }) });
  });
  await contexte.route('https://api.anthropic.com/**', async route => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const rep = typeof anthropic === 'function' ? anthropic(JSON.parse(r.postData() || '{}'), r.url()) : anthropic;
    if (!rep) return route.fulfill({ status: 401, headers: CORS, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    return route.fulfill({ status: rep.status || 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(rep.body ?? rep) });
  });
  await contexte.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => {
    const u = route.request().url();
    if (/api\.github\.com|openfoodfacts|api\.anthropic\.com/.test(u)) return route.fallback();
    return route.abort();
  });
  return gh;
}

/**
 * Lance l'app. options : maintenant (ISO local), sw (service worker), gh, produits, anthropic,
 * etat (fonction exécutée dans la page avant l'app, pour préparer IndexedDB), installe (navigator.standalone).
 */
export async function demarrer({ maintenant = '2026-11-23T12:41:00', sw = false, installe = true, ...reseau } = {}) {
  const { serveur, port } = await demarrerServeur(0);
  const navigateur = await chromium.launch();
  const erreurs = [];
  const gh = reseau.gh || fauxGithub();
  async function nouveauContexte() {
    const c = await navigateur.newContext({ ...devices['iPhone 13'], serviceWorkers: sw ? 'allow' : 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris', permissions: ['clipboard-read', 'clipboard-write'] });
    await c.addInitScript(({ maintenant, installe }) => {
      window.__MAINTENANT__ = maintenant;
      if (installe) Object.defineProperty(navigator, 'standalone', { get: () => true });
    }, { maintenant, installe });
    await fauxReseau(c, { ...reseau, gh });
    c.setDefaultTimeout(8000);
    return c;
  }
  const contexte = await nouveauContexte();
  const page = await contexte.newPage();
  page.on('pageerror', e => erreurs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) erreurs.push(m.text()); });
  const url = `http://127.0.0.1:${port}/SuiviMacro/`;
  return {
    url, page, contexte, navigateur, gh, erreurs,
    /** Un autre appareil : stockage séparé, même faux GitHub. */
    async autreAppareil() {
      const c = await nouveauContexte();
      const p = await c.newPage();
      p.on('pageerror', e => erreurs.push(String(e)));
      return p;
    },
    async fermer() { await navigateur.close(); serveur.close(); },
  };
}

/** Prépare une app déjà configurée (profil, cibles), sans passer par la bienvenue. */
export async function configurer(page, url, { reglages, aliments = [], entrees = [], mesures = [], jours = [], bilans = [], seances = [] } = {}) {
  await page.goto(`${url}#/vide`);
  await page.evaluate(async donnees => {
    const { ouvrirBase } = await import('./js/data/db.js');
    const b = await ouvrirBase();
    const r = donnees.reglages || {
      id: 'reglages',
      profil: { sexe: 'h', naissance: '1990-01-01', tailleCm: 180, activite: 'modere' },
      cibles: { kcal: 2100, prot: 120, gluc: 220, lip: 65, fib: 30, depuis: '2026-10-01' },
      partGlucides: 880 / 1465, rythmePct: 0.5, depenseRetenue: 2800, jourBilan: 1, historiqueCibles: [],
    };
    await b.ecrire('reglages', r);
    for (const [m, recs] of Object.entries({ aliments: donnees.aliments, entrees: donnees.entrees, mesures: donnees.mesures, jours: donnees.jours, bilans: donnees.bilans, seances: donnees.seances })) {
      if (recs.length) await b.ecrirePlusieurs(m, recs);
    }
    b.fermer();
  }, { reglages, aliments, entrees, mesures, jours, bilans, seances });
  await page.goto(`${url}#/accueil`);
  await page.waitForSelector('[data-ecran="accueil"]');
}

/** Attend qu'une condition sur la base soit vraie (fn reçoit les entrées non supprimées). */
export async function attendreBase(page, fn, { magasin = 'entrees', delai = 8000 } = {}) {
  const fin = Date.now() + delai;
  let derniers;
  while (Date.now() < fin) {
    derniers = await page.evaluate(m => window.__suivimacro.base.tous(m), magasin);
    if (fn(derniers)) return derniers;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Condition jamais vraie sur ${magasin} : ${JSON.stringify(derniers?.map(x => x.nom || x.id))}`);
}
