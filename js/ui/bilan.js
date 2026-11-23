// Bilan hebdomadaire (§ 8.3) : la dépense recalculée, les cibles proposées, la décision.
import { html, monter, surActions, brut } from './composants.js';
import { donneesCalcul } from '../data/vues.js';
import { estimerDepense, metabolismeBase } from '../core/depense.js';
import { proposerCibles, resumeSemaine, bornesSemaine, JOURS_AVANT_BILAN } from '../core/coach.js';
import { tendanceAu } from '../core/tendance.js';
import { age, ecartJours } from '../core/dates.js';
import { lireQuantite } from '../core/nutrition.js';
import * as f from '../core/format.js';

export const titre = 'Bilan de la semaine';

const LIGNES = [['kcal', 'Calories', 'kcal'], ['prot', 'Protéines', 'g'], ['gluc', 'Glucides', 'g'], ['lip', 'Lipides', 'g'], ['fib', 'Fibres', 'g']];
const jourFr = j => new Date(`${j}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

function tableau(anciennes, nouvelles) {
  return html`<table class="tableau"><thead><tr><th>Cible</th><th class="num">Actuelle</th><th class="num">Proposée</th><th class="num">Écart</th></tr></thead>
    <tbody>${LIGNES.map(([k, nom, u]) => html`<tr><td>${nom}</td><td class="num">${f.kcal(anciennes[k])} ${u}</td><td class="num" data-proposee="${k}" data-valeur="${nouvelles[k]}">${f.kcal(nouvelles[k])} ${u}</td><td class="num">${nouvelles[k] === anciennes[k] ? '=' : `${f.signe(nouvelles[k] - anciennes[k])} ${u}`}</td></tr>`)}</tbody></table>`;
}

export async function rendre(racine, params, ctx) {
  racine.dataset.ecran = 'bilan';
  const semaine = /^\d{4}-W\d{2}$/.test(params[0] || '') ? params[0] : null;
  if (!semaine) { monter(racine, html`<p class="vide">Bilan introuvable.</p>`); return null; }
  const jour = ctx.jour();
  const d = await donneesCalcul(ctx.base, jour);
  const r = d.reglages;
  const { lundi, dimanche } = bornesSemaine(semaine);
  const deja = d.bilans.find(b => b.id === semaine && b.decision);
  const resume = resumeSemaine({ semaine, entrees: d.entrees, serie: d.serie });

  const resumeHtml = html`<section class="panneau"><h2 class="titre-section">Semaine du ${jourFr(lundi)} au ${jourFr(dimanche)}</h2>
    <ul class="explication">
      <li>${resume.joursSaisis} jour${resume.joursSaisis > 1 ? 's' : ''} saisi${resume.joursSaisis > 1 ? 's' : ''} sur 7${resume.apportsMoyens != null ? `, ${f.kcal(resume.apportsMoyens)} kcal en moyenne` : ''}.</li>
      ${resume.deltaTendance != null ? html`<li>Tendance de poids : ${f.signe(resume.deltaTendance, f.kg)} kg sur la semaine.</li>` : ''}
      ${resume.protMoyennes != null ? html`<li>Protéines : ${f.g(resume.protMoyennes)} g par jour en moyenne (cible ${r.cibles.prot} g). Fibres : ${f.g(resume.fibMoyennes)} g.</li>` : ''}
      <li>${resume.grignotages} grignotage${resume.grignotages > 1 ? 's' : ''} noté${resume.grignotages > 1 ? 's' : ''}.</li>
    </ul></section>`;

  if (deja) {
    monter(racine, html`${resumeHtml}<section class="panneau"><h2 class="titre-section">Décision du ${jourFr(deja.date)}</h2>
      <p>${{ acceptee: 'Cibles proposées acceptées.', modifiee: 'Cibles modifiées à la main.', refusee: 'Cibles actuelles conservées.' }[deja.decision]}</p>
      <ul class="explication">${[...deja.calcul.depense.explication, ...deja.calcul.coach.explication].map(l => html`<li>${l}</li>`)}</ul>
      ${tableau(deja.anciennes || deja.retenues, deja.proposees)}</section>`);
    return null;
  }

  const anciennete = d.premierJour ? ecartJours(d.premierJour, jour) : 0;
  if (!d.serie.length) {
    monter(racine, html`<section class="panneau"><h2 class="titre-section">Il manque une pesée</h2>
      <p>Le bilan mesure ta dépense à partir de ta tendance de poids. Pèse-toi (ou laisse le raccourci envoyer ta pesée) pour le débloquer.</p>
      <div class="actions" style="margin-top:var(--space-sm)"><a class="btn btn--petit" href="#/journal/${jour}">Saisir une pesée</a></div></section>`);
    return null;
  }
  if (anciennete < JOURS_AVANT_BILAN) {
    monter(racine, html`<section class="panneau"><h2 class="titre-section">Encore un peu de patience</h2>
      <p>Le premier bilan arrive après ${JOURS_AVANT_BILAN} jours de données (${anciennete} pour l'instant). Il faut assez de repas saisis et de pesées pour mesurer ta dépense réelle.</p>
      <p class="discret" style="margin-top:var(--space-sm)">Ensuite : au moins 14 jours saisis et 8 pesées sur les 21 derniers jours.</p></section>`);
    return null;
  }

  const depense = estimerDepense({ jour: dimanche, apports: d.apports, statuts: d.statuts, serie: d.serie, depenseRetenue: r.depenseRetenue });
  const tendanceKg = tendanceAu(d.serie, dimanche) ?? d.mesures.filter(m => m.poids).sort((a, b) => (a.id < b.id ? 1 : -1))[0]?.poids;
  const mb = metabolismeBase({ sexe: r.profil.sexe, poidsKg: tendanceKg, tailleCm: r.profil.tailleCm, age: age(r.profil.naissance, jour) });
  const coach = proposerCibles({ depense: depense.valeur, tendanceKg, reglages: r, mb });
  const anciennes = { ...r.cibles };

  monter(racine, html`
    <section class="panneau"><h2 class="titre-section">Ta dépense</h2>
      <ul class="explication">${depense.explication.map(l => html`<li>${l}</li>`)}</ul></section>
    <section class="panneau"><h2 class="titre-section">Tes cibles</h2>
      <ul class="explication">${coach.explication.map(l => html`<li>${l}</li>`)}</ul>
      <div style="margin-top:var(--space-md)">${tableau(anciennes, coach.cibles)}</div>
      <div data-modif hidden style="margin-top:var(--space-md)">
        <div class="rangee">${LIGNES.slice(0, 2).map(([k, nom, u]) => html`<label class="champ"${k === 'prot' ? brut(' style="margin-top:0"') : ''}><span>${nom} (${u})</span><input class="saisie" name="${k}" inputmode="numeric" value="${coach.cibles[k]}"></label>`)}</div>
        <div class="rangee rangee--3" style="margin-top:var(--space-md)">${LIGNES.slice(2).map(([k, nom, u], i) => html`<label class="champ"${i ? brut(' style="margin-top:0"') : ''}><span>${nom} (${u})</span><input class="saisie" name="${k}" inputmode="numeric" value="${coach.cibles[k]}"></label>`)}</div>
        <p class="erreur-texte" role="alert" data-erreur></p>
        <button type="button" class="btn btn--primaire btn--plein" style="margin-top:var(--space-md)" data-action="enregistrerModif">Enregistrer ces cibles</button>
      </div>
    </section>
    ${resumeHtml}
    <div class="actions--pile" data-decision>
      <button type="button" class="btn btn--primaire btn--plein" data-action="accepter">Accepter</button>
      <button type="button" class="btn btn--plein" data-action="modifier">Modifier</button>
      <button type="button" class="btn btn--plein" data-action="garder">Garder les actuelles</button>
    </div>`);

  async function decider(decision, retenues) {
    const calcul = { depense, coach, resume };
    await ctx.base.ecrire('bilans', { id: semaine, date: jour, calcul, anciennes, proposees: coach.cibles, retenues, decision });
    if (decision !== 'refusee') {
      const cibles = { ...retenues, depuis: jour };
      await ctx.base.ecrire('reglages', {
        ...r, cibles, depenseRetenue: Math.round(depense.valeur),
        historiqueCibles: [...(r.historiqueCibles || []), { le: jour, cibles, raison: decision === 'acceptee' ? 'Bilan hebdomadaire' : 'Bilan, modifié à la main', type: 'bilan' }],
      });
    }
    ctx.naviguer('#/accueil');
  }

  return surActions(racine, {
    accepter() { decider('acceptee', coach.cibles); },
    garder() { decider('refusee', anciennes); },
    modifier() { racine.querySelector('[data-modif]').hidden = false; racine.querySelector('[data-decision]').hidden = true; racine.querySelector('[name="kcal"]').focus(); },
    enregistrerModif() {
      const c = Object.fromEntries(LIGNES.map(([k]) => [k, lireQuantite(racine.querySelector(`[name="${k}"]`).value)]));
      if (Object.values(c).some(v => v == null || v <= 0)) { racine.querySelector('[data-erreur]').textContent = 'Les cinq cibles doivent être des nombres positifs.'; return; }
      decider('modifiee', c);
    },
  });
}
