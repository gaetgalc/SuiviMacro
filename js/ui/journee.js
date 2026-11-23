// Éléments partagés par l'accueil et le journal : repas du jour, mesures, séances.
import { html, monter, surActions, feuille, bandeau, brut, icone } from './composants.js';
import { NOMS_REPAS, ouvrirQuantite } from './quantite.js';
import { REPAS } from '../data/vues.js';
import { lireQuantite } from '../core/nutrition.js';
import * as f from '../core/format.js';

const sommeKcal = es => es.reduce((s, e) => s + (e.kcal || 0), 0);

/** Les quatre repas d'une journée. options.complet : actions du journal (copie, enregistrement). */
export function repasHtml(parRepas, { complet = false, estAujourdhui = true } = {}) {
  return REPAS.map(k => {
    const es = parRepas[k] || [];
    return html`<section class="repas" data-repas="${k}">
      <div class="repas-tete"><h3>${NOMS_REPAS[k]}</h3><span class="repas-total"><span class="ligne-valeur">${es.length ? `${f.kcal(sommeKcal(es))} kcal` : ''}</span><button type="button" class="btn-icone" data-action="ajouterRepas" data-repas="${k}" aria-label="Ajouter au ${NOMS_REPAS[k].toLowerCase()}">${icone.plus}</button></span></div>
      ${es.length ? html`<ul class="liste">${es.map(e => html`<li class="ligne${complet ? ' ligne--action' : ''}" style="cursor:default">
          <button type="button" class="ligne" style="grid-column:1/3;min-height:44px;padding:0" data-action="entree" data-id="${e.id}">
            <span class="ligne-nom">${e.nom}<span class="ligne-detail">${quantiteEntree(e)}${e.grignotage ? html` <span class="marque-grignotage">grignotage${e.grignotage.raison ? `, ${e.grignotage.raison}` : ''}</span>` : ''}</span></span>
            <span class="ligne-valeur">${f.kcal(e.kcal)} kcal</span>
          </button>
          ${complet ? html`<button type="button" class="btn-icone" data-action="supprimer" data-id="${e.id}" aria-label="Supprimer ${e.nom}">${icone.poubelle}</button>` : ''}
        </li>`)}</ul>` : ''}
      ${complet ? html`<div class="repas-actions">
        ${complet && es.length && !estAujourdhui ? html`<button type="button" class="btn btn--petit" data-action="copierAujourdhui" data-repas="${k}">Copier vers aujourd'hui</button>` : ''}
        ${complet && !es.length ? html`<button type="button" class="btn btn--petit" data-action="copierVeille" data-repas="${k}">Copier la veille</button>` : ''}
        ${complet && es.length ? html`<button type="button" class="btn btn--petit" data-action="enregistrerRepas" data-repas="${k}">Enregistrer ce repas</button>` : ''}
      </div>` : ''}
    </section>`;
  });
}

export function quantiteEntree(e) {
  if (e.unite === 'rapide') return 'ajout rapide';
  if (e.unite === 'g' || e.unite === 'ml') return `${f.nombre(e.qte, e.qte % 1 ? 1 : 0)} ${e.unite}`;
  return `${f.nombre(e.qte, e.qte % 1 ? 1 : 0)} × ${e.unite}, ${f.g(e.g)} g`;
}

/** Ouvre la feuille Quantité d'une entrée existante (ou une modification simple pour un ajout rapide). */
export async function modifierEntree(ctx, entree) {
  const a = entree.alimentId ? await ctx.base.lire('aliments', entree.alimentId) : null;
  if (a) return ouvrirQuantite(ctx, a, { entree });
  return feuille({
    titre: 'Modifier',
    rendre(corps, api) {
      monter(corps, html`
        <label class="champ"><span>Nom</span><input class="saisie" name="nom" value="${entree.nom}"></label>
        <div class="rangee"><label class="champ"><span>Calories</span><input class="saisie" name="kcal" inputmode="decimal" value="${Math.round(entree.kcal)}"></label>
        <label class="champ" style="margin-top:0"><span>Protéines (g)</span><input class="saisie" name="prot" inputmode="decimal" value="${Math.round(entree.prot)}"></label></div>
        <label class="champ"><span>Repas</span><select class="saisie" name="repas">${Object.entries(NOMS_REPAS).map(([k, v]) => html`<option value="${k}"${k === entree.repas ? brut(' selected') : ''}>${v}</option>`)}</select></label>
        <div class="actions--pile"><button type="button" class="btn btn--primaire btn--plein" data-action="ok">Enregistrer</button><button type="button" class="btn btn--danger" data-action="suppr">Supprimer</button></div>`);
      const v = n => corps.querySelector(`[name="${n}"]`).value;
      surActions(corps, {
        async ok() { await ctx.base.ecrire('entrees', { ...entree, nom: v('nom') || entree.nom, kcal: lireQuantite(v('kcal')) ?? entree.kcal, prot: lireQuantite(v('prot')) ?? entree.prot, repas: v('repas') }); api.fermer(); },
        async suppr() { await ctx.base.supprimer('entrees', entree.id); api.fermer(); bandeau(`${entree.nom} supprimé`, { action: () => ctx.base.ecrire('entrees', { ...entree, supprime: false }) }); },
      });
    },
  });
}

/** Feuille de saisie d'une séance (pour info). */
export function ouvrirSeance(ctx, jour) {
  return feuille({
    titre: 'Séance',
    rendre(corps, api) {
      monter(corps, html`
        <p class="discret">Pour info : une séance ne change pas ton budget.</p>
        <label class="champ"><span>Activité</span><input class="saisie" name="type" placeholder="Football, salle, gravel…" list="types-seance"></label>
        <datalist id="types-seance"><option value="Football"><option value="Musculation"><option value="Gravel"><option value="Course"><option value="Marche"></datalist>
        <div class="rangee"><label class="champ"><span>Durée (min)</span><input class="saisie" name="duree" inputmode="numeric"></label>
        <label class="champ" style="margin-top:0"><span>Calories actives</span><input class="saisie" name="kcal" inputmode="numeric"></label></div>
        <p class="erreur-texte" role="alert" data-erreur></p>
        <button type="button" class="btn btn--primaire btn--plein" data-action="enregistrerSeance">Enregistrer</button>`);
      surActions(corps, {
        async enregistrerSeance() {
          const type = corps.querySelector('[name="type"]').value.trim();
          if (!type) { corps.querySelector('[data-erreur]').textContent = 'Indique l\'activité.'; return; }
          const debut = `${jour}T${ctx.maintenant().toTimeString().slice(0, 5)}`;
          await ctx.base.ecrire('seances', { id: `${debut}|${type}|manuel`, jour, type, debut, dureeMin: lireQuantite(corps.querySelector('[name="duree"]').value), kcalActives: lireQuantite(corps.querySelector('[name="kcal"]').value), source: 'manuel' });
          api.fermer();
        },
      });
      corps.querySelector('[name="type"]').focus();
    },
  });
}

export function seancesHtml(seances) {
  if (!seances.length) return '';
  return html`<ul class="liste">${seances.map(s => html`<li class="ligne" style="cursor:default"><span class="ligne-nom">${s.type}<span class="ligne-detail">${[s.dureeMin ? `${s.dureeMin} min` : null, s.kcalActives ? `${f.kcal(s.kcalActives)} kcal actives` : null].filter(Boolean).join(', ')}, pour info</span></span><span></span></li>`)}</ul>`;
}

/** Actions communes : ajouter à un repas, modifier une entrée. */
export function actionsJournee(ctx, jour, entreesParId, autres = {}) {
  return {
    ajouterRepas(b) { ctx.ouvrirAjouter({ jour, repas: b.dataset.repas }); },
    entree(b) { const e = entreesParId.get(b.dataset.id); if (e) modifierEntree(ctx, e); },
    ...autres,
  };
}

export { surActions };
