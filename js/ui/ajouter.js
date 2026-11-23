// Feuille « Ajouter » (§ 10.1) : recherche, habituels, repas enregistrés, favoris.
import { html, monter, surActions, feuille, bandeau, brut, icone, temporiser } from './composants.js';
import { NOMS_REPAS, ouvrirQuantite, libelleSource } from './quantite.js';
import { chercher } from '../core/recherche.js';
import { habituels } from '../core/suggestions.js';
import { valeurs, lireQuantite } from '../core/nutrition.js';
import { repasSelonHeure, heureLocale } from '../core/dates.js';
import { ajouterEntree, ajouterRepasType, ajouterRapide, annuler } from '../data/aliments.js';
import { creerOff } from '../data/off.js';
import { bilanDuJour } from '../data/vues.js';
import * as f from '../core/format.js';

let off = null;

function ligneAliment(a, { kcal, detail, direct = false }) {
  return html`<li><div class="ligne ligne--action" style="cursor:default">
    <button type="button" class="ligne" style="grid-column:1/3;min-height:44px;padding:0" data-action="choisir" data-id="${a.id}">
      <span class="ligne-nom">${a.nom}<span class="ligne-detail">${detail}</span></span>
      <span class="ligne-valeur">${kcal}</span>
    </button>
    ${direct ? html`<button type="button" class="btn-icone" data-action="direct" data-id="${a.id}" aria-label="Ajouter ${a.nom} directement">${icone.plus}</button>` : html`<span></span>`}
  </div></li>`;
}

const parCent = a => `${f.kcal(a.p100?.kcal ?? 0)} kcal / 100 g`;
const quantiteTexte = (a, h) => (h.unite === 'g' || h.unite === 'ml' ? `${f.nombre(h.qte, h.qte % 1 ? 1 : 0)} ${h.unite}` : `${f.nombre(h.qte, h.qte % 1 ? 1 : 0)} ${a.portions?.find(p => p.id === h.unite)?.nom || h.unite}`);

export async function ouvrirAjouter(ctx, { jour = ctx.jour(), repas } = {}) {
  let repasChoisi = repas || repasSelonHeure(ctx.maintenant());
  const vus = new Map();
  let requeteOff = null;
  off ||= creerOff({ base: ctx.base });
  const cle = await ctx.base.secret('cleApi');

  return feuille({
    titre: 'Ajouter',
    rendre(corps) {
      monter(corps, html`
        <div class="rangee" style="align-items:end">
          <label class="champ"><span>Repas</span><select class="saisie" name="repas">${Object.entries(NOMS_REPAS).map(([k, v]) => html`<option value="${k}"${k === repasChoisi ? brut(' selected') : ''}>${v}</option>`)}</select></label>
          <p class="discret" data-restant style="margin:0 0 var(--space-xs)"></p>
        </div>
        <input class="saisie saisie--grande" name="recherche" type="search" placeholder="Rechercher un aliment" autocomplete="off" autocapitalize="off" enterkeyhint="search" aria-label="Rechercher un aliment">
        <div class="puces">
          <button type="button" class="puce" data-action="code">Code-barres</button>
          <button type="button" class="puce" data-action="phrase">Phrase</button>
          ${cle ? html`<button type="button" class="puce" data-action="photo">Photo</button>` : ''}
          <button type="button" class="puce" data-action="rapide">Rapide</button>
          <button type="button" class="puce" data-action="recette">Recette</button>
        </div>
        <div data-contenu></div>`);
      const champ = corps.querySelector('[name="recherche"]');
      const contenu = corps.querySelector('[data-contenu]');

      async function majRestant() {
        const b = await bilanDuJour(ctx.base, jour);
        monter(corps.querySelector('[data-restant]'), html`Restant ${f.kcal(b.restant.kcal)} kcal, protéines ${f.g(b.restant.prot)} g`);
      }

      async function afficherAccueil() {
        const [entrees, aliments, repasTypes] = await Promise.all([ctx.base.tous('entrees'), ctx.base.tous('aliments'), ctx.base.tous('repasTypes')]);
        const parId = new Map(aliments.map(a => [a.id, a]));
        const hab = habituels(entrees, parId, jour, repasChoisi).slice(0, 12);
        const favoris = aliments.filter(a => a.favori).sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
        [...hab.map(h => h.aliment), ...favoris].forEach(a => vus.set(a.id, a));
        if (champ.value.trim()) return;
        monter(contenu, html`
          <section><h3 class="titre-section">Habituels au ${NOMS_REPAS[repasChoisi].toLowerCase()}</h3>
            ${hab.length ? html`<ul class="liste" data-habituels>${hab.map(h => ligneAliment(h.aliment, { kcal: `${f.kcal(valeurs(h.aliment, h.qte, h.unite).kcal)} kcal`, detail: quantiteTexte(h.aliment, h), direct: true }))}</ul>`
              : html`<p class="vide">Les aliments que tu ajoutes à ce repas apparaîtront ici, prêts à être ajoutés en un geste.</p>`}
          </section>
          ${repasTypes.length ? html`<section><h3 class="titre-section">Repas enregistrés</h3><ul class="liste">${repasTypes.map(r => html`<li><button type="button" class="ligne" data-action="repasType" data-id="${r.id}"><span class="ligne-nom">${r.nom}<span class="ligne-detail">${r.items.length} aliment${r.items.length > 1 ? 's' : ''}</span></span><span class="ligne-valeur">Ajouter</span></button></li>`)}</ul></section>` : ''}
          ${favoris.length ? html`<section><h3 class="titre-section">Favoris</h3><ul class="liste">${favoris.map(a => ligneAliment(a, { kcal: parCent(a), detail: libelleSource(a), direct: !!a.derniere }))}</ul></section>` : ''}`);
      }

      async function rechercher() {
        const q = champ.value.trim();
        requeteOff?.abort();
        if (!q) { afficherAccueil(); return; }
        let idx;
        try { idx = await ctx.index(); } catch { monter(contenu, html`<p class="erreur-texte">La base d'aliments n'a pas pu se charger. Réessaie dans un instant.</p>`); return; }
        const r = chercher(idx, q, { usages: await ctx.usages(), limite: 25 });
        if (champ.value.trim() !== q) return;
        r.forEach(x => vus.set(x.aliment.id, x.aliment));
        monter(contenu, html`
          ${r.length ? html`<ul class="liste" data-resultats>${r.map(x => ligneAliment(x.aliment, { kcal: parCent(x.aliment), detail: libelleSource(x.aliment) }))}</ul>`
            : html`<p class="vide">Rien trouvé dans les aliments enregistrés pour « ${q} ».</p>`}
          <div class="actions" style="margin-top:var(--space-sm)">
            <button type="button" class="btn btn--petit" data-action="creer">Créer un aliment</button>
            <button type="button" class="btn btn--petit" data-action="phrase">Estimer en phrase</button>
          </div>
          <section data-produits style="margin-top:var(--space-lg)"><h3 class="titre-section">Produits <span class="discret">Open Food Facts</span></h3><p class="discret" data-etat-off>${q.length < 3 ? 'Tape au moins 3 lettres.' : 'Recherche…'}</p></section>`);
        if (q.length >= 3) chercherProduits(q);
      }

      const chercherProduits = temporiser(async q => {
        const zone = contenu.querySelector('[data-produits]');
        if (!zone || champ.value.trim() !== q) return;
        requeteOff = new AbortController();
        try {
          const produits = await off.chercher(q, { signal: requeteOff.signal });
          if (champ.value.trim() !== q) return;
          produits.forEach(a => vus.set(a.id, a));
          monter(zone, html`<h3 class="titre-section">Produits <span class="discret">Open Food Facts</span></h3>
            ${produits.length ? html`<ul class="liste">${produits.slice(0, 15).map(a => ligneAliment(a, { kcal: parCent(a), detail: a.marque || 'Open Food Facts' }))}</ul>` : html`<p class="vide">Aucun produit trouvé.</p>`}`);
        } catch (e) {
          if (e.name === 'AbortError') return;
          const etat = zone.querySelector('[data-etat-off]');
          if (etat) etat.textContent = navigator.onLine === false ? 'Hors connexion : produits indisponibles.' : 'Open Food Facts ne répond pas pour l\'instant.';
        }
      }, 400);

      async function choisir(aliment) {
        if (aliment.incomplet) {
          const { ouvrirCreation } = await import('./aliment.js');
          ouvrirCreation(ctx, { nom: aliment.nom, code: aliment.code, surCree: a => ouvrirQuantite(ctx, a, { jour, repas: repasChoisi, surFin: rafraichir }) });
          return;
        }
        ouvrirQuantite(ctx, aliment, { jour, repas: repasChoisi, surFin: rafraichir });
      }

      function rafraichir() { majRestant(); if (!champ.value.trim()) afficherAccueil(); }

      champ.addEventListener('input', temporiser(rechercher, 120));
      corps.addEventListener('change', e => { if (e.target.name === 'repas') { repasChoisi = e.target.value; afficherAccueil(); } });
      surActions(corps, {
        choisir(b) { const a = vus.get(b.dataset.id); if (a) choisir(a); },
        async direct(b) {
          const a = await ctx.base.lire('aliments', b.dataset.id);
          if (!a?.derniere) { choisir(vus.get(b.dataset.id)); return; }
          const e = await ajouterEntree(ctx.base, { aliment: a, qte: a.derniere.qte, unite: a.derniere.unite, jour, repas: repasChoisi, heure: heureLocale(ctx.maintenant()), mode: 'recherche' });
          bandeau(`${e.nom} ajouté`, { action: () => annuler(ctx.base, [e.id]).then(rafraichir) });
          rafraichir();
        },
        async repasType(b) {
          const r = await ctx.base.lire('repasTypes', b.dataset.id);
          const es = await ajouterRepasType(ctx.base, r, jour, repasChoisi, heureLocale(ctx.maintenant()));
          bandeau(`${r.nom} ajouté`, { action: () => annuler(ctx.base, es.map(x => x.id)).then(rafraichir) });
          rafraichir();
        },
        async creer() {
          const { ouvrirCreation } = await import('./aliment.js');
          ouvrirCreation(ctx, { nom: champ.value.trim(), surCree: a => ouvrirQuantite(ctx, a, { jour, repas: repasChoisi, surFin: rafraichir }) });
        },
        async recette() {
          const { ouvrirRecette } = await import('./aliment.js');
          ouvrirRecette(ctx, { surCree: a => ouvrirQuantite(ctx, a, { jour, repas: repasChoisi, surFin: rafraichir }) });
        },
        rapide() { ouvrirRapide(ctx, { jour, repas: repasChoisi, surFin: rafraichir }); },
        async code() { (await import('./scanner.js')).ouvrirScanner(ctx, { jour, repas: repasChoisi, surFin: rafraichir }); },
        async phrase() { (await import('./phrase.js')).ouvrirPhrase(ctx, { jour, repas: repasChoisi, texte: champ.value.trim(), surFin: rafraichir }); },
        async photo() { (await import('./phrase.js')).ouvrirPhoto(ctx, { jour, repas: repasChoisi, surFin: rafraichir }); },
      });
      majRestant();
      afficherAccueil();
      champ.focus();
    },
  });
}

export function ouvrirRapide(ctx, { jour, repas, surFin }) {
  return feuille({
    titre: 'Ajout rapide',
    surFermer: surFin,
    rendre(corps, api) {
      monter(corps, html`
        <p class="discret">Quand tu connais le total : un plat au restaurant, une étiquette.</p>
        <label class="champ"><span>Nom</span><input class="saisie" name="nom" placeholder="Resto midi"></label>
        <div class="rangee">
          <label class="champ"><span>Calories (kcal)</span><input class="saisie saisie--grande" name="kcal" inputmode="decimal" required></label>
          <label class="champ" style="margin-top:0"><span>Protéines (g)</span><input class="saisie saisie--grande" name="prot" inputmode="decimal"></label>
        </div>
        <div class="rangee" style="margin-top:var(--space-md)">
          <label class="champ"><span>Glucides (g)</span><input class="saisie" name="gluc" inputmode="decimal"></label>
          <label class="champ" style="margin-top:0"><span>Lipides (g)</span><input class="saisie" name="lip" inputmode="decimal"></label>
        </div>
        <p class="erreur-texte" role="alert" data-erreur></p>
        <button type="button" class="btn btn--primaire btn--plein" data-action="ajouterRapide">Ajouter</button>`);
      const v = n => lireQuantite(corps.querySelector(`[name="${n}"]`).value);
      surActions(corps, {
        async ajouterRapide() {
          const kcal = v('kcal');
          if (kcal == null) { corps.querySelector('[data-erreur]').textContent = 'Indique au moins les calories.'; return; }
          const e = await ajouterRapide(ctx.base, { nom: corps.querySelector('[name="nom"]').value.trim(), kcal, prot: v('prot') || 0, gluc: v('gluc') || 0, lip: v('lip') || 0, jour, repas, heure: heureLocale(ctx.maintenant()) });
          api.fermer();
          bandeau(`${e.nom} ajouté`, { action: () => annuler(ctx.base, [e.id]) });
        },
      });
      corps.querySelector('[name="nom"]').focus();
    },
  });
}
