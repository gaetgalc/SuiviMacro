// Accueil (§ 12) : tendance d'abord, puis restant du jour, puis journal du jour.
import { html, monter, surActions, explication, niveau, graphiqueLigne, bandeau, chargement, erreurBloc } from './composants.js';
import { repasHtml, seancesHtml, actionsJournee } from './journee.js';
import { donneesCalcul, etatAccueil } from '../data/vues.js';
import { ajouterEntree, annuler } from '../data/aliments.js';
import { joursAvantExpiration } from './reglages.js';
import { heureLocale, repasSelonHeure, ajouterJours } from '../core/dates.js';
import * as f from '../core/format.js';

export const titre = 'Aujourd\'hui';

const penteTexte = p => (p ? `${f.signe(p.kgSemaine, x => f.nombre(x, 2))} kg par semaine (${f.signe(p.pctSemaine, x => f.nombre(x, 2))} %)` : 'Pente après 7 jours de pesées');

export async function rendre(racine, params, ctx) {
  racine.dataset.ecran = 'accueil';
  monter(racine, chargement(4));
  const jour = ctx.jour();
  let d, e;
  try {
    d = await donneesCalcul(ctx.base, jour);
    e = etatAccueil(d, jour);
  } catch (err) {
    monter(racine, erreurBloc(`Impossible de calculer l'accueil : ${err.message}`));
    return null;
  }
  const expire = await joursAvantExpiration(ctx);
  const depasse = e.restant.kcal < 0;
  const debut = ajouterJours(jour, -29);
  const trente = e.serie.filter(x => x.jour >= debut);
  const graph = trente.length >= 2 ? graphiqueLigne([
    { points: trente.map((x, i) => [i, x.poids]), type: 'points' },
    { points: trente.map((x, i) => [i, x.tendance]) },
  ], { hauteur: 84, titre: 'Poids des 30 derniers jours' }) : '';

  monter(racine, html`
    ${e.bilanDu ? html`<a class="alerte" data-bloc="bilan" href="#/bilan/${e.bilanDu.semaine}" style="text-decoration:none;color:inherit"><b>Ton bilan de la semaine est prêt</b><span class="discret">Nouvelle estimation de ta dépense et cibles proposées, à accepter ou modifier.</span></a>` : ''}
    ${expire != null && expire <= 14 ? html`<a class="alerte" href="#/reglages/synchronisation" style="text-decoration:none;color:inherit">${expire < 0 ? 'Ton jeton GitHub a expiré : la synchronisation est arrêtée.' : `Ton jeton GitHub expire dans ${expire} jour${expire > 1 ? 's' : ''}.`}</a>` : ''}
    ${e.aConfirmer.map(p => html`<div class="alerte" data-bloc="pesee"><p>Pesée du ${new Date(`${p.jour}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : ${f.kg(p.poids)} kg, loin de ta tendance. Erreur de balance ?</p>
      <div class="actions"><button type="button" class="btn btn--petit" data-action="confirmerPesee" data-jour="${p.jour}">C'est bien mon poids</button><button type="button" class="btn btn--petit" data-action="ignorerPesee" data-jour="${p.jour}">L'ignorer</button></div></div>`)}

    <section class="panneau tendance" data-bloc="tendance">
      ${e.tendance == null ? html`<h2 class="titre-section">Tendance</h2><p class="vide">Pèse-toi (ou laisse le raccourci envoyer ta pesée) pour voir ta tendance de poids.</p><div class="actions"><a class="btn btn--petit" href="#/journal/${jour}">Saisir une pesée</a></div>` : html`
        <div class="tendance-ligne">
          <div><span class="discret">Tendance</span><div><span class="figure figure--moyenne">${f.kg(e.tendance)}</span><span class="unite">kg</span></div></div>
          <p class="discret" style="text-align:right">${penteTexte(e.pente)}</p>
        </div>
        ${graph}`}
      <div class="tendance-ligne" style="border-top:var(--rule-hair) solid var(--color-rule);padding-top:var(--space-sm)">
        <button type="button" class="chiffre-bouton" data-action="expliquerDepense"><span class="discret">Dépense estimée</span><span><span class="figure figure--moyenne">${f.kcal(e.depense.valeur)}</span><span class="unite">kcal/j</span></span></button>
        <span class="discret" style="text-align:right">${e.depense.misAJour ? `${e.depense.joursValides} jours saisis sur 21` : 'Estimation de départ'}</span>
      </div>
    </section>

    <section class="panneau restant" data-bloc="restant">
      <div class="restant-tete">
        <button type="button" class="chiffre-bouton" data-action="expliquerRestant">
          <span class="figure figure--grande"${depasse ? ' data-depasse' : ''}>${f.kcal(Math.abs(e.restant.kcal))}</span>
          <span class="discret">${depasse ? 'kcal au-dessus de ta cible' : 'kcal restantes'}</span>
        </button>
        <span class="discret">${f.kcal(e.totaux.kcal)} mangées sur ${f.kcal(e.cibles.kcal)}</span>
      </div>
      <div class="lit niveaux">
        ${niveau('Protéines', e.totaux.prot, e.cibles.prot)}
        ${niveau('Glucides', e.totaux.gluc, e.cibles.gluc)}
        ${niveau('Lipides', e.totaux.lip, e.cibles.lip)}
        ${niveau('Fibres', e.totaux.fib, e.cibles.fib)}
      </div>
    </section>

    ${e.suggestions.length ? html`<section data-bloc="suggestion">
      <h2 class="titre-section">Il te manque ${f.g(e.restant.prot)} g de protéines <span class="discret">${f.kcal(Math.max(0, e.restant.kcal))} kcal restantes</span></h2>
      <ul class="liste">${e.suggestions.map((s, i) => html`<li><button type="button" class="ligne" data-action="suggestion" data-i="${i}">
        <span class="ligne-nom">${s.items.map(it => `${it.aliment.nom} ${it.unite === 'g' ? `${f.g(it.qte)} g` : `${f.nombre(it.qte, it.qte % 1 ? 1 : 0)} ${it.aliment.portions?.find(p => p.id === it.unite)?.nom || it.unite}`}`).join(' + ')}<span class="ligne-detail">${f.g(s.prot)} g de protéines, ${f.kcal(s.kcal)} kcal</span></span>
        <span class="ligne-valeur">Ajouter</span></button></li>`)}</ul>
    </section>` : ''}

    <section data-bloc="journal">
      <h2 class="titre-section">Journal <a class="lien discret" href="#/journal/${jour}">Voir la journée</a></h2>
      ${repasHtml(e.parRepas)}
    </section>

    ${e.seances.length ? html`<section data-bloc="seances"><h2 class="titre-section">Séances</h2>${seancesHtml(e.seances)}</section>` : ''}`);

  const parId = new Map(Object.values(e.parRepas).flat().map(x => [x.id, x]));
  return surActions(racine, actionsJournee(ctx, jour, parId, {
    expliquerDepense() { explication('Dépense estimée', e.depense.explication); },
    expliquerRestant() {
      explication('Restant du jour', [
        `Cible du jour : ${f.kcal(e.cibles.kcal)} kcal, ${e.cibles.prot} g de protéines.`,
        `Mangé : ${f.kcal(e.totaux.kcal)} kcal, ${f.g(e.totaux.prot)} g de protéines.`,
        `Restant : ${f.kcal(e.restant.kcal)} kcal, ${f.g(e.restant.prot)} g de protéines.`,
        `La cible vient de ${e.cibles.depuis ? `tes réglages du ${new Date(`${e.cibles.depuis}T12:00`).toLocaleDateString('fr-FR')}` : 'tes réglages'} ; elle ne change qu'au bilan, avec ton accord.`,
      ]);
    },
    async suggestion(b) {
      const s = e.suggestions[Number(b.dataset.i)];
      const repas = repasSelonHeure(ctx.maintenant());
      const ajoutees = [];
      for (const it of s.items) ajoutees.push(await ajouterEntree(ctx.base, { aliment: it.aliment, qte: it.qte, unite: it.unite, jour, repas, heure: heureLocale(ctx.maintenant()), mode: 'recherche' }));
      bandeau('Suggestion ajoutée', { action: () => annuler(ctx.base, ajoutees.map(x => x.id)) });
    },
    async confirmerPesee(b) {
      const m = await ctx.base.lire('mesures', b.dataset.jour);
      await ctx.base.ecrire('mesures', { ...m, poidsConfirme: true });
    },
    async ignorerPesee(b) {
      const m = await ctx.base.lire('mesures', b.dataset.jour);
      const { poids, ...reste } = m;
      await ctx.base.ecrire('mesures', { ...reste, poidsIgnore: poids });
    },
  }));
}

