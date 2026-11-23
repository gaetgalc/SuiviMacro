// Démarrage, routeur, synchronisation automatique.
import { ouvrirBase, MAGASINS_SYNC } from './data/db.js';
import { creerDepot } from './data/depot.js';
import { creerSync } from './data/sync.js';
import { jourLogique } from './core/dates.js';
import { ciqualVersAliments, creerIndex, ajouterAIndex, retirerDeIndex } from './core/recherche.js';
import { platsVersAliments } from './core/phrase.js';
import { bandeau, html, monter, erreurBloc } from './ui/composants.js';

const ECRANS = {
  accueil: () => import('./ui/accueil.js'),
  journal: () => import('./ui/journal.js'),
  tendances: () => import('./ui/tendances.js'),
  reglages: () => import('./ui/reglages.js'),
  bilan: () => import('./ui/bilan.js'),
  bienvenue: () => import('./ui/bienvenue.js'),
  vide: async () => ({ titre: 'SuiviMacro', rendre: r => { r.dataset.ecran = 'vide'; } }),
};
const ONGLET = { accueil: 'accueil', journal: 'journal', tendances: 'tendances', bilan: 'tendances', reglages: 'reglages' };

export const maintenant = () => (window.__MAINTENANT__ ? new Date(window.__MAINTENANT__) : new Date());

async function charger(url) {
  const r = await fetch(new URL(url, document.baseURI));
  if (!r.ok) throw new Error(`${url} : HTTP ${r.status}`);
  return r.json();
}

function creerContexte(base) {
  let donnees = null, index = null;
  const ctx = {
    base,
    maintenant,
    jour: () => jourLogique(maintenant()),
    sync: null,
    naviguer(hash) { if (location.hash === hash) rendre(); else location.hash = hash; },
    async reglages() { return base.lire('reglages', 'reglages'); },
    donnees() {
      donnees ||= Promise.all([charger('data/ciqual.json'), charger('data/plats.json'), charger('data/portions.json')])
        .then(([ciqual, plats, portions]) => ({ ciqual, plats, portions }))
        .catch(e => { donnees = null; throw e; });
      return donnees;
    },
    index() {
      index ||= (async () => {
        const { ciqual, plats } = await ctx.donnees();
        const idx = creerIndex([...ciqualVersAliments(ciqual), ...platsVersAliments(plats)]);
        for (const a of await base.tous('aliments')) ajouterAIndex(idx, a);
        return idx;
      })().catch(e => { index = null; throw e; });
      return index;
    },
    async rafraichirIndex(aliment) {
      if (!index) return;
      const idx = await index;
      if (aliment.supprime) retirerDeIndex(idx, aliment.id); else ajouterAIndex(idx, aliment);
    },
    async usages() {
      const m = new Map();
      for (const a of await base.tous('aliments')) if (a.utilisations) m.set(a.id, { n: a.utilisations, dernier: a.dernierUsage });
      return m;
    },
    async ouvrirAjouter(opts = {}) {
      const { ouvrirAjouter } = await import('./ui/ajouter.js');
      return ouvrirAjouter(ctx, { jour: ctx.jour(), ...opts });
    },
    async configurerSync() {
      const jeton = await base.secret('jeton');
      ctx.sync = null;
      if (jeton) {
        const depot = creerDepot({ jeton });
        ctx.sync = creerSync({ base, depot });
        ctx.sync.surEtat(afficherPastille);
        await ctx.sync.charger();
        ctx.sync.synchroniser();
      }
      afficherPastille(ctx.sync?.etat());
      return ctx.sync;
    },
  };
  return ctx;
}

let ctx, nettoyer = null, rendu = 0;

function afficherPastille(etat) {
  const p = document.getElementById('pastille-sync');
  if (!p) return;
  let texte = '', type = '';
  if (!ctx.sync) { texte = 'Non synchronisé'; type = 'local'; }
  else if (etat?.erreur === 'jeton') { texte = 'Jeton refusé'; type = 'erreur'; }
  else if (etat?.erreur === 'reseau') { texte = etat.enAttente ? `Hors ligne, ${etat.enAttente} en attente` : 'Hors ligne'; type = 'attente'; }
  else if (etat?.erreur) { texte = 'Erreur de synchronisation'; type = 'erreur'; }
  else if (etat?.enAttente) { texte = `${etat.enAttente} en attente`; type = 'attente'; }
  p.hidden = !texte;
  p.textContent = texte;
  p.dataset.etat = type;
}

function lireRoute() {
  const [nom, ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { nom: ECRANS[nom] ? nom : 'accueil', params: params.filter(Boolean) };
}

async function rendre() {
  const n = ++rendu;
  const racine = document.getElementById('ecran');
  let { nom, params } = lireRoute();
  if (nom !== 'bienvenue' && nom !== 'vide' && !(await ctx.reglages())) { location.replace('#/bienvenue'); return; }
  const module = await ECRANS[nom]();
  if (n !== rendu) return;
  nettoyer?.();
  nettoyer = null;
  delete racine.dataset.ecran;
  document.querySelectorAll('.onglets [data-onglet]').forEach(a => a.toggleAttribute('aria-current', false));
  const actif = document.querySelector(`.onglets [data-onglet="${ONGLET[nom]}"]`);
  if (actif) actif.setAttribute('aria-current', 'page');
  document.querySelector('.onglets').hidden = nom === 'bienvenue';
  document.getElementById('titre-ecran').textContent = typeof module.titre === 'function' ? module.titre(params, ctx) : module.titre;
  try {
    nettoyer = (await module.rendre(racine, params, ctx)) || null;
  } catch (e) {
    console.error(e);
    monter(racine, erreurBloc(`Cet écran n'a pas pu s'afficher : ${e.message}`, html`<button class="btn" type="button" onclick="location.reload()">Recharger</button>`));
  }
}

let rerendu = null;
function rerendreBientot() {
  clearTimeout(rerendu);
  rerendu = setTimeout(() => {
    if (lireRoute().nom === 'bienvenue') return;
    // Ne jamais effacer une saisie en cours : on attend que le champ perde le focus.
    const actif = document.activeElement;
    if (actif?.closest?.('#ecran') && /^(INPUT|TEXTAREA|SELECT)$/.test(actif.tagName)) {
      actif.addEventListener('blur', rerendreBientot, { once: true });
      return;
    }
    rendre();
  }, 60);
}

function programmerSync(base) {
  let t = null;
  base.surChangement(m => {
    if (!MAGASINS_SYNC.includes(m) || !ctx.sync) return;
    clearTimeout(t);
    t = setTimeout(() => ctx.sync?.synchroniser(), 3000);
    afficherPastille({ ...ctx.sync.etat(), enAttente: Math.max(1, ctx.sync.etat().enAttente) });
  });
  document.addEventListener('visibilitychange', () => { if (ctx.sync) ctx.sync.synchroniser(); });
  setInterval(() => { if (ctx.sync && document.visibilityState === 'visible') ctx.sync.synchroniser(); }, 5 * 60000);
}

function serviceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nouveau = reg.installing;
      nouveau?.addEventListener('statechange', () => {
        if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
          bandeau('Mise à jour disponible', { libelle: 'Recharger', duree: 0, action: () => { sessionStorage.setItem('sm-maj', '1'); nouveau.postMessage('activer'); } });
        }
      });
    });
  }).catch(e => console.warn('Service worker :', e.message));
  let recharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recharge && sessionStorage.getItem('sm-maj')) { recharge = true; location.reload(); } });
}

async function demarrer() {
  const base = await ouvrirBase();
  ctx = creerContexte(base);
  window.__suivimacro = ctx;
  navigator.storage?.persist?.().catch(() => {});
  document.getElementById('bouton-ajouter').addEventListener('click', () => ctx.ouvrirAjouter());
  window.addEventListener('hashchange', rendre);
  base.surChangement(m => {
    if (m === 'aliments') return;
    rerendreBientot();
  });
  programmerSync(base);
  await ctx.configurerSync().catch(e => console.warn(e));
  serviceWorker();
  await rendre();
}

demarrer().catch(e => {
  console.error(e);
  monter(document.getElementById('ecran'), erreurBloc(`SuiviMacro n'a pas pu démarrer : ${e.message}`));
});
