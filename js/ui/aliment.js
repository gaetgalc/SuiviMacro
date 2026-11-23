// Aliments perso : création, recette, fiche, liste (§ 10.7, § 12).
import { html, monter, surActions, feuille, bandeau, brut } from './composants.js';
import { lireQuantite, p100Recette } from '../core/nutrition.js';
import { chercher } from '../core/recherche.js';
import { ORIGINES, LIBELLES } from '../core/proteines.js';
import { creerAlimentPerso, adopter, modifierAliment } from '../data/aliments.js';
import { libelleSource } from './quantite.js';
import * as f from '../core/format.js';

const champsValeurs = (p = {}) => html`
  <div class="rangee">
    <label class="champ"><span>Calories (kcal)</span><input class="saisie" name="kcal" inputmode="decimal" value="${p.kcal ?? ''}"></label>
    <label class="champ" style="margin-top:0"><span>Protéines (g)</span><input class="saisie" name="prot" inputmode="decimal" value="${p.prot ?? ''}"></label>
  </div>
  <div class="rangee rangee--3" style="margin-top:var(--space-md)">
    <label class="champ"><span>Glucides (g)</span><input class="saisie" name="gluc" inputmode="decimal" value="${p.gluc ?? ''}"></label>
    <label class="champ" style="margin-top:0"><span>Lipides (g)</span><input class="saisie" name="lip" inputmode="decimal" value="${p.lip ?? ''}"></label>
    <label class="champ" style="margin-top:0"><span>Fibres (g)</span><input class="saisie" name="fib" inputmode="decimal" value="${p.fib ?? ''}"></label>
  </div>`;

const choixOrigine = (o = 'autres') => html`<label class="champ"><span>Origine des protéines</span><select class="saisie" name="origine">${ORIGINES.map(x => html`<option value="${x}"${x === o ? brut(' selected') : ''}>${LIBELLES[x]}</option>`)}</select></label>`;

function lireValeurs(corps) {
  const v = n => lireQuantite(corps.querySelector(`[name="${n}"]`).value);
  const p = { kcal: v('kcal'), prot: v('prot') ?? 0, gluc: v('gluc') ?? 0, lip: v('lip') ?? 0, fib: v('fib') };
  return p.kcal == null ? null : p;
}

/** Création d'un aliment (valeurs de l'étiquette pour 100 g, ou pour une portion). */
export function ouvrirCreation(ctx, { nom = '', code, surCree } = {}) {
  let cree = null;
  return feuille({
    titre: 'Nouvel aliment',
    surFermer: () => { if (cree) surCree?.(cree); },
    rendre(corps, api) {
      monter(corps, html`
        ${code ? html`<p class="discret">Code-barres ${code} : il sera retrouvé au prochain scan.</p>` : ''}
        <label class="champ"><span>Nom</span><input class="saisie" name="nom" value="${nom}" required></label>
        <fieldset class="champ" style="border:0;padding:0;margin:var(--space-md) 0 0"><legend class="etiquette">Valeurs de l'étiquette</legend>
          <div class="puces"><button type="button" class="puce" data-action="base" data-valeur="100" aria-pressed="true">pour 100 g</button><button type="button" class="puce" data-action="base" data-valeur="portion" aria-pressed="false">pour une portion</button></div>
        </fieldset>
        <div class="rangee" data-portion hidden>
          <label class="champ"><span>Portion</span><input class="saisie" name="pnom" placeholder="barre"></label>
          <label class="champ" style="margin-top:0"><span>Poids (g)</span><input class="saisie" name="pg" inputmode="decimal"></label>
        </div>
        ${champsValeurs()}
        ${choixOrigine()}
        <p class="erreur-texte" role="alert" data-erreur></p>
        <button type="button" class="btn btn--primaire btn--plein" data-action="enregistrer">Enregistrer et ajouter</button>`);
      let parPortion = false;
      surActions(corps, {
        base(b) {
          parPortion = b.dataset.valeur === 'portion';
          corps.querySelectorAll('[data-action="base"]').forEach(x => x.setAttribute('aria-pressed', x === b));
          corps.querySelector('[data-portion]').hidden = !parPortion;
        },
        async enregistrer() {
          const erreur = corps.querySelector('[data-erreur]');
          const nomSaisi = corps.querySelector('[name="nom"]').value.trim();
          let p = lireValeurs(corps);
          if (!nomSaisi || !p) { erreur.textContent = 'Il faut au moins un nom et les calories.'; return; }
          const portions = [];
          if (parPortion) {
            const g = lireQuantite(corps.querySelector('[name="pg"]').value);
            if (!(g > 0)) { erreur.textContent = 'Indique le poids de la portion.'; return; }
            p = Object.fromEntries(Object.entries(p).map(([k, x]) => [k, x == null ? null : (x / g) * 100]));
            portions.push({ id: 'portion', nom: corps.querySelector('[name="pnom"]').value.trim() || 'portion', g });
          }
          cree = await creerAlimentPerso(ctx.base, { nom: nomSaisi, p100: p, portions, origineProt: corps.querySelector('[name="origine"]').value, ref: code });
          await ctx.rafraichirIndex(cree);
          api.fermer();
        },
      });
    },
  });
}

/** Recette multi-portions (batch cooking). */
export function ouvrirRecette(ctx, { surCree, recette = null } = {}) {
  const ingredients = [];
  let cree = null;
  return feuille({
    titre: recette ? 'Modifier la recette' : 'Nouvelle recette',
    surFermer: () => { if (cree) surCree?.(cree); },
    async rendre(corps, api) {
      if (recette) {
        for (const i of recette.recette.ingredients) {
          const a = await ctx.base.lire('aliments', i.alimentId);
          if (a) ingredients.push({ aliment: a, g: i.g });
        }
      }
      monter(corps, html`
        <label class="champ"><span>Nom</span><input class="saisie" name="nom" value="${recette?.nom || ''}"></label>
        <div class="rangee">
          <label class="champ"><span>Nombre de parts</span><input class="saisie" name="nbParts" inputmode="numeric" value="${recette?.recette.nbPortions || 4}"></label>
          <label class="champ" style="margin-top:0"><span>Poids cuit (g, facultatif)</span><input class="saisie" name="poidsCuit" inputmode="decimal" value="${recette?.recette.poidsCuitG || ''}"></label>
        </div>
        <h3 class="titre-section" style="margin-top:var(--space-lg)">Ingrédients <span class="discret">poids crus</span></h3>
        <ul class="liste" data-ingredients></ul>
        <input class="saisie" name="ingredient" type="search" placeholder="Ajouter un ingrédient" autocomplete="off" aria-label="Ajouter un ingrédient">
        <ul class="liste" data-propositions></ul>
        <p class="discret" data-total></p>
        <p class="erreur-texte" role="alert" data-erreur></p>
        <button type="button" class="btn btn--primaire btn--plein" data-action="enregistrerRecette">Enregistrer la recette</button>`);
      const propositions = new Map();
      function dessinerIngredients() {
        monter(corps.querySelector('[data-ingredients]'), ingredients.map((i, n) => html`<li class="ligne ligne--action" style="cursor:default">
          <span class="ligne-nom">${i.aliment.nom}</span>
          <input class="saisie" style="width:88px" name="g-${n}" inputmode="decimal" value="${i.g}" aria-label="Grammes de ${i.aliment.nom}">
          <button type="button" class="btn-icone" data-action="retirer" data-n="${n}" aria-label="Retirer ${i.aliment.nom}">×</button></li>`));
        majTotal();
      }
      function majTotal() {
        ingredients.forEach((i, n) => { const g = lireQuantite(corps.querySelector(`[name="g-${n}"]`)?.value); if (g != null) i.g = g; });
        const total = ingredients.reduce((s, i) => s + i.g, 0);
        const p = p100Recette(ingredients, total);
        corps.querySelector('[data-total]').textContent = ingredients.length ? `Total ${f.g(total)} g crus, ${f.kcal((p.kcal * total) / 100)} kcal, ${f.g((p.prot * total) / 100)} g de protéines.` : '';
      }
      corps.addEventListener('input', async e => {
        if (e.target.name?.startsWith('g-')) { majTotal(); return; }
        if (e.target.name !== 'ingredient') return;
        const q = e.target.value.trim();
        const zone = corps.querySelector('[data-propositions]');
        if (!q) { zone.innerHTML = ''; return; }
        const r = chercher(await ctx.index(), q, { usages: await ctx.usages(), limite: 6 }).filter(x => x.aliment.source !== 'recette');
        propositions.clear();
        r.forEach(x => propositions.set(x.aliment.id, x.aliment));
        monter(zone, r.map(x => html`<li><button type="button" class="ligne" data-action="ingredient" data-id="${x.aliment.id}"><span class="ligne-nom">${x.aliment.nom}<span class="ligne-detail">${libelleSource(x.aliment)}</span></span><span class="ligne-valeur">Ajouter</span></button></li>`));
      });
      surActions(corps, {
        ingredient(b) {
          ingredients.push({ aliment: propositions.get(b.dataset.id), g: 100 });
          corps.querySelector('[name="ingredient"]').value = '';
          corps.querySelector('[data-propositions]').innerHTML = '';
          dessinerIngredients();
          corps.querySelector(`[name="g-${ingredients.length - 1}"]`).select();
        },
        retirer(b) { majTotal(); ingredients.splice(Number(b.dataset.n), 1); dessinerIngredients(); },
        async enregistrerRecette() {
          majTotal();
          const nom = corps.querySelector('[name="nom"]').value.trim();
          const nb = lireQuantite(corps.querySelector('[name="nbParts"]').value);
          const cuit = lireQuantite(corps.querySelector('[name="poidsCuit"]').value);
          const erreur = corps.querySelector('[data-erreur]');
          if (!nom || !ingredients.length || !(nb > 0)) { erreur.textContent = 'Il faut un nom, au moins un ingrédient et un nombre de parts.'; return; }
          const adoptes = [];
          for (const i of ingredients) adoptes.push({ aliment: await adopter(ctx.base, i.aliment), g: i.g });
          const total = cuit || adoptes.reduce((s, i) => s + i.g, 0);
          const p100 = p100Recette(adoptes, total);
          const parts = [{ id: 'part', nom: 'part', g: Math.round((total / nb) * 10) / 10 }];
          const champsRecette = { ingredients: adoptes.map(i => ({ alimentId: i.aliment.id, g: i.g })), poidsCuitG: cuit || null, nbPortions: nb };
          const origines = {};
          adoptes.forEach(i => { origines[i.aliment.origineProt || 'autres'] = (origines[i.aliment.origineProt || 'autres'] || 0) + (i.aliment.p100.prot * i.g) / 100; });
          const origineProt = Object.entries(origines).sort((a, b) => b[1] - a[1])[0]?.[0] || 'autres';
          if (recette) cree = await modifierAliment(ctx.base, { ...recette, nom, p100, portions: parts, recette: champsRecette, origineProt });
          else cree = await creerAlimentPerso(ctx.base, { nom, p100, portions: parts, origineProt, source: 'recette', recette: champsRecette });
          await ctx.rafraichirIndex(cree);
          api.fermer();
        },
      });
      dessinerIngredients();
      corps.querySelector('[name="nom"]').focus();
    },
  });
}

/** Fiche d'un aliment : valeurs, portions, origine, favori, suppression. */
export function ouvrirFiche(ctx, aliment, { surFin } = {}) {
  if (aliment.source === 'recette') return ouvrirRecette(ctx, { recette: aliment, surCree: surFin });
  return feuille({
    titre: aliment.nom,
    surFermer: surFin,
    rendre(corps, api) {
      monter(corps, html`
        <p class="discret">${libelleSource(aliment)}. Valeurs pour 100 g.</p>
        <label class="champ"><span>Nom</span><input class="saisie" name="nom" value="${aliment.nom}"></label>
        ${champsValeurs(Object.fromEntries(Object.entries(aliment.p100 || {}).map(([k, v]) => [k, v == null ? '' : Math.round(v * 10) / 10])))}
        ${choixOrigine(aliment.origineProt)}
        <h3 class="titre-section" style="margin-top:var(--space-lg)">Portions</h3>
        <ul class="liste">${(aliment.portions || []).map(p => html`<li class="ligne ligne--action" style="cursor:default"><span class="ligne-nom">${p.nom}</span><span class="ligne-valeur">${p.g} g</span><button type="button" class="btn-icone" data-action="retirerPortion" data-id="${p.id}" aria-label="Retirer la portion ${p.nom}">×</button></li>`)}</ul>
        ${(aliment.portions || []).length ? '' : html`<p class="vide">Aucune portion : ajoute-en une depuis la feuille Quantité.</p>`}
        <label class="case"><input type="checkbox" name="favori"${aliment.favori ? brut(' checked') : ''}> Favori</label>
        <label class="case"><input type="checkbox" name="passees"> Appliquer aussi aux entrées passées</label>
        <p class="erreur-texte" role="alert" data-erreur></p>
        <div class="actions--pile">
          <button type="button" class="btn btn--primaire btn--plein" data-action="enregistrerFiche">Enregistrer</button>
          <button type="button" class="btn btn--danger" data-action="supprimerAliment">Supprimer cet aliment</button>
        </div>`);
      let portions = [...(aliment.portions || [])];
      surActions(corps, {
        retirerPortion(b) { portions = portions.filter(p => p.id !== b.dataset.id); b.closest('li').remove(); },
        async enregistrerFiche() {
          const p = lireValeurs(corps);
          if (!p) { corps.querySelector('[data-erreur]').textContent = 'Les calories sont obligatoires.'; return; }
          const a = await modifierAliment(ctx.base, {
            ...aliment, nom: corps.querySelector('[name="nom"]').value.trim() || aliment.nom, p100: p, portions,
            origineProt: corps.querySelector('[name="origine"]').value, favori: corps.querySelector('[name="favori"]').checked,
          }, { passees: corps.querySelector('[name="passees"]').checked });
          await ctx.rafraichirIndex(a);
          api.fermer();
          bandeau('Aliment enregistré.');
        },
        async supprimerAliment() {
          const a = await ctx.base.supprimer('aliments', aliment.id);
          await ctx.rafraichirIndex(a);
          api.fermer();
          bandeau(`${aliment.nom} supprimé`, { action: async () => ctx.rafraichirIndex(await ctx.base.ecrire('aliments', { ...a, supprime: false })) });
        },
      });
    },
  });
}

/** Réglages > Mes aliments. */
export async function rendreMesAliments(racine, ctx) {
  const [aliments, repasTypes] = await Promise.all([ctx.base.tous('aliments'), ctx.base.tous('repasTypes')]);
  const tri = (a, b) => a.nom.localeCompare(b.nom, 'fr');
  const perso = aliments.filter(a => a.source === 'perso').sort(tri);
  const recettes = aliments.filter(a => a.source === 'recette').sort(tri);
  const autres = aliments.filter(a => a.source !== 'perso' && a.source !== 'recette').sort((a, b) => (b.utilisations || 0) - (a.utilisations || 0));
  const liste = items => (items.length ? html`<ul class="liste">${items.map(a => html`<li><button type="button" class="ligne" data-action="fiche" data-id="${a.id}"><span class="ligne-nom">${a.nom}<span class="ligne-detail">${libelleSource(a)}</span></span><span class="ligne-valeur">${f.kcal(a.p100?.kcal || 0)} kcal / 100 g</span></button></li>`)}</ul>` : html`<p class="vide">Rien pour l'instant.</p>`);
  monter(racine, html`
    <p><a class="lien" href="#/reglages">Retour aux réglages</a></p>
    <section><h2 class="titre-section">Mes aliments</h2>${liste(perso)}</section>
    <section><h2 class="titre-section">Recettes</h2>${liste(recettes)}<div class="actions" style="margin-top:var(--space-sm)"><button type="button" class="btn btn--petit" data-action="nouvelleRecette">Nouvelle recette</button></div></section>
    <section><h2 class="titre-section">Repas enregistrés</h2>${repasTypes.length ? html`<ul class="liste">${repasTypes.map(r => html`<li class="ligne ligne--action" style="cursor:default"><span class="ligne-nom">${r.nom}<span class="ligne-detail">${r.items.length} aliment(s)</span></span><button type="button" class="btn btn--petit" data-action="renommer" data-id="${r.id}">Renommer</button><button type="button" class="btn-icone" data-action="supprimerRepas" data-id="${r.id}" aria-label="Supprimer ${r.nom}">×</button></li>`)}</ul>` : html`<p class="vide">Depuis le journal, « Enregistrer ce repas » le rend ajoutable en un geste.</p>`}</section>
    <section><h2 class="titre-section">Déjà utilisés</h2>${liste(autres)}</section>`);
  const parId = new Map(aliments.map(a => [a.id, a]));
  return surActions(racine, {
    fiche(b) { ouvrirFiche(ctx, parId.get(b.dataset.id)); },
    nouvelleRecette() { ouvrirRecette(ctx, {}); },
    async renommer(b) {
      const r = await ctx.base.lire('repasTypes', b.dataset.id);
      const nom = prompt('Nouveau nom du repas', r.nom);
      if (nom?.trim()) await ctx.base.ecrire('repasTypes', { ...r, nom: nom.trim() });
    },
    async supprimerRepas(b) {
      const r = await ctx.base.supprimer('repasTypes', b.dataset.id);
      bandeau(`${r.nom} supprimé`, { action: () => ctx.base.ecrire('repasTypes', { ...r, supprime: false }) });
    },
  });
}
