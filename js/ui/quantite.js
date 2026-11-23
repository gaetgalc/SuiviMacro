// Feuille « Quantité » (§ 10.2) : préremplie, restant après ajout, grignotage, favori.
import { html, monter, surActions, feuille, bandeau, brut, icone } from './composants.js';
import { valeurs, lireQuantite, restant as calculRestant } from '../core/nutrition.js';
import { portionsPour } from '../core/phrase.js';
import { RAISONS } from '../core/grignotage.js';
import { heureLocale } from '../core/dates.js';
import { ajouterEntree, modifierEntree, adopter, annuler } from '../data/aliments.js';
import { bilanDuJour } from '../data/vues.js';
import * as f from '../core/format.js';

export const NOMS_REPAS = { petitdej: 'Petit-déj', dejeuner: 'Déjeuner', collation: 'Collation', diner: 'Dîner' };
export const LIBELLES_RAISONS = { faim: 'faim', ennui: 'ennui', stress: 'stress', fatigue: 'fatigue', social: 'social', envie: 'envie', autre: 'autre' };
const SOURCES = { ciqual: 'Ciqual', off: 'Open Food Facts', perso: 'Mon aliment', recette: 'Recette', plat: 'Plat type', ia: 'Estimation' };

export const libelleSource = a => [SOURCES[a.source] || '', a.marque].filter(Boolean).join(', ');

/** Unité par défaut : dernière utilisée, sinon première portion, sinon 100 g. */
export function quantiteParDefaut(aliment, portions) {
  if (aliment.derniere && (aliment.derniere.unite === 'g' || aliment.derniere.unite === 'ml' || portions.some(p => p.id === aliment.derniere.unite))) return aliment.derniere;
  if (portions.length) return { qte: 1, unite: portions[0].id };
  return { qte: 100, unite: 'g' };
}

export async function ouvrirQuantite(ctx, aliment0, { jour, repas, entree = null, surFin } = {}) {
  const { portions: table } = await ctx.donnees();
  const aliment = { ...aliment0, portions: portionsPour(aliment0, table) };
  const etat = entree ? { qte: entree.qte, unite: entree.unite } : quantiteParDefaut(aliment, aliment.portions);
  let grignotage = entree?.grignotage || null;
  let repasChoisi = entree?.repas || repas;
  const jourDuJournal = entree?.jour || jour;
  const bilan = await bilanDuJour(ctx.base, jourDuJournal);
  const dejaCompte = entree ? { kcal: entree.kcal, prot: entree.prot } : { kcal: 0, prot: 0 };

  return feuille({
    titre: entree ? 'Modifier' : aliment.nom,
    surFermer: surFin,
    rendre(corps, api) {
      const raccourcis = () => (etat.unite === 'g' || etat.unite === 'ml' ? [50, 100, 150, 200] : [0.5, 1, 1.5, 2]);
      function dessiner() {
        monter(corps, html`
          <p class="discret">${entree ? aliment.nom : libelleSource(aliment)}</p>
          <div class="rangee rangee--qte">
            <label class="champ"><span>Quantité</span><input class="saisie saisie--grande" name="qte" inputmode="decimal" value="${String(etat.qte).replace('.', ',')}" aria-describedby="recap"></label>
            <label class="champ" style="margin-top:0"><span>Unité</span><select class="saisie saisie--grande" name="unite">
              <option value="g"${etat.unite === 'g' ? brut(' selected') : ''}>grammes</option>
              ${aliment.portions.map(p => html`<option value="${p.id}"${etat.unite === p.id ? brut(' selected') : ''}>${p.nom} (${p.g} g)</option>`)}
              <option value="+">ajouter une portion…</option>
            </select></label>
          </div>
          <div class="puces" aria-label="Quantités rapides">${raccourcis().map(v => html`<button type="button" class="puce" data-action="rapide" data-valeur="${v}">${String(v).replace('.', ',')}${etat.unite === 'g' ? ' g' : ''}</button>`)}</div>
          <div data-nouvelle-portion hidden class="rangee">
            <label class="champ"><span>Nom de la portion</span><input class="saisie" name="pnom" placeholder="bol"></label>
            <label class="champ" style="margin-top:0"><span>Poids (g)</span><input class="saisie" name="pg" inputmode="decimal" placeholder="300"></label>
            <button type="button" class="btn" data-action="creerPortion" style="grid-column:1/-1">Enregistrer la portion</button>
          </div>
          <div class="recap" id="recap" aria-live="polite"></div>
          <p class="restant-apres" id="restant-apres" aria-live="polite"></p>
          <label class="champ"><span>Repas</span><select class="saisie" name="repas">${Object.entries(NOMS_REPAS).map(([k, v]) => html`<option value="${k}"${k === repasChoisi ? brut(' selected') : ''}>${v}</option>`)}</select></label>
          <label class="case"><input type="checkbox" name="grignotage"${grignotage ? brut(' checked') : ''}> Grignotage</label>
          <div class="puces" data-raisons${grignotage ? '' : brut(' hidden')}>${RAISONS.map(r => html`<button type="button" class="puce" data-action="raison" data-valeur="${r}" aria-pressed="${grignotage?.raison === r}">${LIBELLES_RAISONS[r]}</button>`)}</div>
          <p class="erreur-texte" id="erreur-qte" role="alert"></p>
          <div class="actions--pile">
            <button type="button" class="btn btn--primaire btn--plein" data-action="valider">${entree ? 'Enregistrer' : 'Ajouter'}</button>
            <div class="actions">
              ${entree ? html`<button type="button" class="btn btn--danger" data-action="supprimer">Supprimer</button>` : ''}
              ${aliment.source !== 'ia' ? html`<button type="button" class="btn" data-action="favori" aria-pressed="${!!aliment0.favori}">${icone.etoile}${aliment0.favori ? 'Favori' : 'Ajouter aux favoris'}</button>` : ''}
              ${aliment.id && !aliment.incomplet ? html`<button type="button" class="btn" data-action="fiche">Fiche</button>` : ''}
            </div>
          </div>`);
        majRecap();
      }
      function lire() {
        const q = lireQuantite(corps.querySelector('[name="qte"]').value);
        return q && q > 0 ? q : null;
      }
      function majRecap() {
        const q = lire();
        const recap = corps.querySelector('#recap'), apres = corps.querySelector('#restant-apres');
        if (q == null) { recap.innerHTML = ''; apres.textContent = 'Indique une quantité.'; return; }
        const v = valeurs(aliment, q, etat.unite);
        monter(recap, html`${[['kcal', v.kcal], ['prot', v.prot, 'g'], ['gluc', v.gluc, 'g'], ['lip', v.lip, 'g'], ['fibres', v.fib, 'g']].map(([n, x, u]) => html`<div><b>${x == null ? '–' : Math.round(x)}</b><span>${n}${u ? ` (${u})` : ''}</span></div>`)}`);
        const r = calculRestant(bilan.cibles, { ...bilan.totaux, kcal: bilan.totaux.kcal - dejaCompte.kcal + v.kcal, prot: bilan.totaux.prot - dejaCompte.prot + v.prot });
        monter(apres, html`Restant après : <b>${f.kcal(r.kcal)} kcal</b>, protéines <b>${f.g(r.prot)} g</b>`);
      }
      dessiner();
      corps.addEventListener('input', e => {
        if (e.target.name === 'qte') majRecap();
      });
      corps.addEventListener('change', e => {
        if (e.target.name === 'unite') {
          if (e.target.value === '+') { corps.querySelector('[data-nouvelle-portion]').hidden = false; e.target.value = etat.unite; return; }
          const ancien = etat.unite;
          etat.unite = e.target.value;
          const q = lire();
          if (q != null && ancien !== etat.unite) {
            const g = ancien === 'g' || ancien === 'ml' ? q : q * (aliment.portions.find(p => p.id === ancien)?.g || 100);
            const pg = etat.unite === 'g' ? 1 : aliment.portions.find(p => p.id === etat.unite).g;
            etat.qte = Math.round((g / pg) * (etat.unite === 'g' ? 1 : 4)) / (etat.unite === 'g' ? 1 : 4) || 1;
          }
          dessiner();
        }
        if (e.target.name === 'grignotage') {
          grignotage = e.target.checked ? { raison: null } : null;
          corps.querySelector('[data-raisons]').hidden = !grignotage;
        }
        if (e.target.name === 'repas') repasChoisi = e.target.value;
      });
      surActions(corps, {
        rapide(b) { corps.querySelector('[name="qte"]').value = b.dataset.valeur.replace('.', ','); majRecap(); },
        raison(b) {
          grignotage = { raison: b.dataset.valeur };
          corps.querySelectorAll('[data-action="raison"]').forEach(x => x.setAttribute('aria-pressed', x === b));
        },
        async creerPortion() {
          const nom = corps.querySelector('[name="pnom"]').value.trim();
          const g = lireQuantite(corps.querySelector('[name="pg"]').value);
          if (!nom || !(g > 0)) { corps.querySelector('#erreur-qte').textContent = 'Donne un nom et un poids à la portion.'; return; }
          const id = nom.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'portion';
          const portion = { id: aliment.portions.some(p => p.id === id) ? `${id}-${aliment.portions.length}` : id, nom, g };
          const a = await adopter(ctx.base, aliment0);
          const enregistre = await ctx.base.ecrire('aliments', { ...a, portions: [...(a.portions || []), portion] });
          Object.assign(aliment0, enregistre);
          aliment.portions = portionsPour(enregistre, table);
          aliment.id = enregistre.id;
          etat.unite = portion.id; etat.qte = 1;
          dessiner();
        },
        async favori() {
          const a = await adopter(ctx.base, aliment0);
          const maj = await ctx.base.ecrire('aliments', { ...a, favori: !a.favori });
          Object.assign(aliment0, maj);
          await ctx.rafraichirIndex(maj);
          dessiner();
        },
        async fiche() {
          const { ouvrirFiche } = await import('./aliment.js');
          const a = await adopter(ctx.base, aliment0);
          api.fermer();
          ouvrirFiche(ctx, a);
        },
        async supprimer() {
          await annuler(ctx.base, [entree.id]);
          api.fermer();
          bandeau(`${entree.nom} supprimé`, { action: () => ctx.base.ecrire('entrees', { ...entree, supprime: false }) });
        },
        async valider(b) {
          const q = lire();
          if (q == null) { corps.querySelector('#erreur-qte').textContent = 'Indique une quantité supérieure à zéro.'; corps.querySelector('[name="qte"]').setAttribute('aria-invalid', 'true'); return; }
          b.setAttribute('aria-busy', 'true');
          let e;
          if (entree) e = await modifierEntree(ctx.base, entree, { qte: q, unite: etat.unite, repas: repasChoisi, grignotage });
          else {
            e = await ajouterEntree(ctx.base, { aliment: { ...aliment0, portions: aliment.portions }, qte: q, unite: etat.unite, jour: jourDuJournal, repas: repasChoisi, heure: heureLocale(ctx.maintenant()), mode: aliment0.mode || 'recherche', grignotage });
            const a = await ctx.base.lire('aliments', e.alimentId);
            if (a) await ctx.rafraichirIndex(a);
          }
          api.resultat = e;
          api.fermer();
          if (!entree) bandeau(`${e.nom} ajouté`, { action: () => annuler(ctx.base, [e.id]) });
        },
      });
      corps.querySelector('[name="qte"]').focus({ preventScroll: true });
      corps.querySelector('[name="qte"]').select?.();
    },
  });
}
