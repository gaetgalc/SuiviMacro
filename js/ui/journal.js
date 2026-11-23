// Journal d'une journée (§ 12) : repas, statut, mesures, séances, origine des protéines.
import { html, monter, surActions, bandeau, icone, brut } from './composants.js';
import { repasHtml, seancesHtml, actionsJournee, ouvrirSeance } from './journee.js';
import { NOMS_REPAS } from './quantite.js';
import { REPAS } from '../data/vues.js';
import { somme, lireQuantite } from '../core/nutrition.js';
import { repartition, ORIGINES, LIBELLES } from '../core/proteines.js';
import { jourValide } from '../core/depense.js';
import { ajouterJours, heureLocale } from '../core/dates.js';
import * as f from '../core/format.js';

const dateLongue = j => new Date(`${j}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const valide = j => /^\d{4}-\d{2}-\d{2}$/.test(j || '');

export const titre = (params, ctx) => {
  const j = valide(params[0]) ? params[0] : ctx.jour();
  return j === ctx.jour() ? 'Journal' : dateLongue(j).replace(/^./, c => c.toUpperCase());
};

const totalRep = rep => Object.values(rep).reduce((s, x) => s + x, 0);

export function barreOrigine(rep) {
  const total = totalRep(rep);
  if (!total) return '';
  const parts = ORIGINES.filter(o => rep[o] > 0);
  return html`<div class="empile" role="img" aria-label="${parts.map(o => `${LIBELLES[o]} ${Math.round((rep[o] / total) * 100)} %`).join(', ')}">${parts.map(o => html`<span class="o-${o}" style="width:${((rep[o] / total) * 100).toFixed(1)}%"></span>`)}</div>`;
}

/** Légende commune à plusieurs barres : les origines présentes au moins une fois. */
export function legendeOrigines(liste) {
  const presentes = ORIGINES.filter(o => liste.some(x => x.rep[o] > 0));
  return html`<div class="legende">${presentes.map(o => html`<span><i class="o-${o}"></i>${LIBELLES[o]}</span>`)}</div>`;
}

export function origineHtml(rep) {
  const total = totalRep(rep);
  if (!total) return '';
  return html`${barreOrigine(rep)}
    <div class="legende">${ORIGINES.filter(o => rep[o] > 0).map(o => html`<span><i class="o-${o}"></i>${LIBELLES[o]} ${Math.round((rep[o] / total) * 100)} %</span>`)}</div>`;
}

export async function rendre(racine, params, ctx) {
  racine.dataset.ecran = 'journal';
  const aujourdhui = ctx.jour();
  const jour = valide(params[0]) ? params[0] : aujourdhui;
  const [entrees, statutRec, mesure, seances] = await Promise.all([
    ctx.base.parIndex('entrees', 'jour', jour), ctx.base.lire('jours', jour), ctx.base.lire('mesures', jour),
    ctx.base.tous('seances').then(s => s.filter(x => x.jour === jour)),
  ]);
  const parRepas = Object.fromEntries(REPAS.map(k => [k, entrees.filter(e => e.repas === k).sort((a, b) => (a.heure || '').localeCompare(b.heure || ''))]));
  const t = somme(entrees);
  const statut = statutRec?.statut || 'auto';
  const douteux = entrees.length > 0 && jour < aujourdhui && statut === 'auto' && !jourValide(t.kcal, 'auto');

  monter(racine, html`
    <nav class="actions" style="justify-content:space-between;align-items:center" aria-label="Changer de jour">
      <button type="button" class="btn-icone" data-action="jourPrecedent" aria-label="Jour précédent">${icone.retour}</button>
      <label class="discret" style="display:grid;justify-items:center">${dateLongue(jour)}<input type="date" class="visually-hidden" name="date" value="${jour}" max="${aujourdhui}" aria-label="Choisir une date"></label>
      <button type="button" class="btn-icone" data-action="jourSuivant" aria-label="Jour suivant"${jour >= aujourdhui ? brut(' disabled') : ''}>${icone.suivant}</button>
    </nav>
    <div class="actions" style="justify-content:center">${jour !== aujourdhui ? html`<a class="btn btn--petit" href="#/journal/${aujourdhui}">Aujourd'hui</a>` : ''}<button type="button" class="btn btn--petit" data-action="calendrier">Choisir une date</button></div>

    <section class="panneau">
      <div class="restant-tete"><span><span class="figure figure--moyenne">${f.kcal(t.kcal)}</span><span class="unite">kcal</span></span>
        <span class="discret">P ${f.g(t.prot)} g, G ${f.g(t.gluc)} g, L ${f.g(t.lip)} g, fibres ${f.g(t.fib)} g</span></div>
      <div style="margin-top:var(--space-sm)">${origineHtml(repartition(entrees))}</div>
      ${douteux ? html`<div class="alerte" style="margin-top:var(--space-md)" data-bloc="journee"><p>Seulement ${f.kcal(t.kcal)} kcal notées. Journée complète ?</p><p class="discret">Une journée incomplète est écartée du calcul de ta dépense.</p>
        <div class="actions"><button type="button" class="btn btn--petit" data-action="journeeComplete">Oui, complète</button><button type="button" class="btn btn--petit" data-action="journeeIncomplete">Non, incomplète</button></div></div>` : ''}
      ${statut !== 'auto' ? html`<p class="discret" style="margin-top:var(--space-sm)">Journée marquée ${statut === 'complet' ? 'complète' : 'incomplète'}. <button type="button" class="lien" data-action="journeeAuto">Annuler</button></p>` : ''}
    </section>

    ${repasHtml(parRepas, { complet: true, estAujourdhui: jour === aujourdhui })}

    <section class="panneau" style="margin-top:var(--space-xl)" data-bloc="mesures">
      <h2 class="titre-section">Mesures ${mesure?.sources?.poids === 'raccourci' ? html`<span class="discret">pesée reçue du raccourci</span>` : ''}</h2>
      <div class="rangee rangee--3">
        <label class="champ"><span>Poids (kg)</span><input class="saisie" name="poids" inputmode="decimal" value="${mesure?.poids != null ? String(mesure.poids).replace('.', ',') : ''}"></label>
        <label class="champ" style="margin-top:0"><span>Tour de taille (cm)</span><input class="saisie" name="tourTaille" inputmode="decimal" value="${mesure?.tourTaille ?? ''}"></label>
        <label class="champ" style="margin-top:0"><span>Masse grasse (%)</span><input class="saisie" name="gras" inputmode="decimal" value="${mesure?.grasPct != null ? String(mesure.grasPct).replace('.', ',') : ''}"></label>
      </div>
      <p class="erreur-texte" role="alert" data-erreur-mesure></p>
      <div class="actions" style="margin-top:var(--space-sm)"><button type="button" class="btn btn--petit" data-action="enregistrerMesure">Enregistrer les mesures</button></div>
    </section>

    <section data-bloc="seances" style="margin-top:var(--space-lg)">
      <h2 class="titre-section">Séances <span class="discret">pour info</span></h2>
      ${seances.length ? seancesHtml(seances) : html`<p class="vide">Aucune séance ce jour-là.</p>`}
      <div class="actions"><button type="button" class="btn btn--petit" data-action="ajouterSeance">${icone.plus}Ajouter une séance</button></div>
    </section>`);

  const parId = new Map(entrees.map(e => [e.id, e]));
  const copier = async (sources, versJour, repas) => {
    const ids = [];
    for (const e of sources) {
      const { id, majLe, appareil, ...reste } = e;
      ids.push((await ctx.base.ecrire('entrees', { ...reste, id: `e:${crypto.randomUUID()}`, jour: versJour, repas, heure: heureLocale(ctx.maintenant()), mode: 'copie' })).id);
    }
    return ids;
  };
  const statutJour = s => ctx.base.ecrire('jours', { ...(statutRec || { id: jour }), id: jour, statut: s });
  racine.querySelector('[name="date"]').addEventListener('change', e => { if (valide(e.target.value)) ctx.naviguer(`#/journal/${e.target.value}`); });

  return surActions(racine, actionsJournee(ctx, jour, parId, {
    jourPrecedent() { ctx.naviguer(`#/journal/${ajouterJours(jour, -1)}`); },
    jourSuivant() { if (jour < aujourdhui) ctx.naviguer(`#/journal/${ajouterJours(jour, 1)}`); },
    calendrier() { const c = racine.querySelector('[name="date"]'); c.showPicker?.() ?? c.focus(); },
    async supprimer(b) {
      const e = parId.get(b.dataset.id);
      await ctx.base.supprimer('entrees', e.id);
      bandeau(`${e.nom} supprimé`, { action: () => ctx.base.ecrire('entrees', { ...e, supprime: false }) });
    },
    async copierAujourdhui(b) {
      const ids = await copier(parRepas[b.dataset.repas], aujourdhui, b.dataset.repas);
      bandeau(`${NOMS_REPAS[b.dataset.repas]} copié vers aujourd'hui`, { action: () => Promise.all(ids.map(id => ctx.base.supprimer('entrees', id))) });
    },
    async copierVeille(b) {
      const veille = (await ctx.base.parIndex('entrees', 'jour', ajouterJours(jour, -1))).filter(e => e.repas === b.dataset.repas);
      if (!veille.length) { bandeau('Rien à copier : ce repas était vide la veille.'); return; }
      const ids = await copier(veille, jour, b.dataset.repas);
      bandeau(`${NOMS_REPAS[b.dataset.repas]} de la veille copié`, { action: () => Promise.all(ids.map(id => ctx.base.supprimer('entrees', id))) });
    },
    async enregistrerRepas(b) {
      const es = parRepas[b.dataset.repas].filter(e => e.alimentId);
      if (!es.length) { bandeau('Ce repas ne contient que des ajouts rapides.'); return; }
      const nom = prompt('Nom du repas', `${NOMS_REPAS[b.dataset.repas]} habituel`);
      if (!nom?.trim()) return;
      await ctx.base.ecrire('repasTypes', { id: `rt:${crypto.randomUUID()}`, nom: nom.trim(), items: es.map(e => ({ alimentId: e.alimentId, qte: e.qte, unite: e.unite })) });
      bandeau(`« ${nom.trim()} » enregistré`);
    },
    journeeComplete() { statutJour('complet'); },
    journeeIncomplete() { statutJour('incomplet'); },
    journeeAuto() { statutJour('auto'); },
    async enregistrerMesure() {
      const v = n => racine.querySelector(`[name="${n}"]`).value.trim();
      const poids = v('poids') ? lireQuantite(v('poids')) : null, taille = v('tourTaille') ? lireQuantite(v('tourTaille')) : null, gras = v('gras') ? lireQuantite(v('gras')) : null;
      const err = racine.querySelector('[data-erreur-mesure]');
      if ((v('poids') && !(poids > 20 && poids < 400)) || (v('tourTaille') && !(taille > 30)) || (v('gras') && !(gras > 0 && gras < 80))) { err.textContent = 'Vérifie les valeurs saisies.'; return; }
      const m = mesure || { id: jour, sources: {} };
      const sources = { ...(m.sources || {}) };
      if (poids !== (m.poids ?? null)) sources.poids = 'manuel';
      if (gras !== (m.grasPct ?? null)) sources.gras = 'manuel';
      await ctx.base.ecrire('mesures', { ...m, poids, tourTaille: taille, grasPct: gras, sources });
      bandeau('Mesures enregistrées.');
    },
    ajouterSeance() { ouvrirSeance(ctx, jour); },
  }));
}
