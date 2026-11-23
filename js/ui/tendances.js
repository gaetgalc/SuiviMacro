// Tendances (§ 12) : poids, dépense, apports, protéines, grignotage, historique des bilans.
import { html, monter, surActions, graphiqueLigne, chargement } from './composants.js';
import { barreOrigine, legendeOrigines } from './journal.js';
import { donneesCalcul } from '../data/vues.js';
import { estimerDepense } from '../core/depense.js';
import { statsGrignotage, phraseGrignotage, RAISONS } from '../core/grignotage.js';
import { repartition } from '../core/proteines.js';
import { resumeSemaine, bornesSemaine } from '../core/coach.js';
import { ajouterJours, semaineIso, lundiDe } from '../core/dates.js';
import * as f from '../core/format.js';

export const titre = 'Tendances';
const PERIODES = [['30', '30 jours'], ['90', '3 mois'], ['365', '1 an']];
const court = j => new Date(`${j}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export async function rendre(racine, params, ctx) {
  racine.dataset.ecran = 'tendances';
  monter(racine, chargement(5));
  const periode = PERIODES.some(p => p[0] === params[0]) ? Number(params[0]) : 30;
  const jour = ctx.jour();
  const debut = ajouterJours(jour, -(periode - 1));
  const d = await donneesCalcul(ctx.base, jour);
  const serie = d.serie.filter(x => x.jour >= debut);

  // Semaines de la période (lundis), la plus ancienne d'abord.
  const semaines = [];
  for (let l = lundiDe(debut); l <= jour; l = ajouterJours(l, 7)) semaines.push(semaineIso(l));
  const resumes = semaines.map(s => ({ s, ...resumeSemaine({ semaine: s, entrees: d.entrees, serie: d.serie }) }));

  // Dépense mesurée en fin de chaque semaine.
  const depenses = resumes.map(r => {
    const fin = r.dimanche > jour ? jour : r.dimanche;
    const e = estimerDepense({ jour: fin, apports: d.apports, statuts: d.statuts, serie: d.serie, depenseRetenue: d.reglages.depenseRetenue });
    return { fin, mesuree: e.mesuree };
  });
  const retenues = d.bilans.filter(b => b.decision && b.decision !== 'refusee' && b.date >= debut);
  const retenuePour = fin => {
    const b = retenues.find(x => x.date > fin && x.date <= ajouterJours(fin, 7));
    return b ? Math.round(b.calcul.depense.valeur) : null;
  };

  const etiquettes = serie.length > 1 ? [[0, court(serie[0].jour)], [serie.length - 1, court(serie.at(-1).jour)]] : null;
  const gStats = statsGrignotage(d.entrees, jour, Math.min(periode, 30));
  const maxCreneau = Math.max(1, ...Object.values(gStats.parCreneau));
  const derniereMesure = k => d.mesures.filter(m => m[k] != null).sort((a, b) => (a.id < b.id ? 1 : -1))[0];
  const taille = derniereMesure('tourTaille'), gras = derniereMesure('grasPct');
  const semainesProt = resumes.slice(-8).map(r => ({ r, rep: repartition(d.entrees.filter(e => e.jour >= r.lundi && e.jour <= r.dimanche)) })).filter(x => Object.values(x.rep).some(v => v > 0));

  monter(racine, html`
    <div class="puces" role="group" aria-label="Période">${PERIODES.map(([v, t]) => html`<button type="button" class="puce" data-action="periode" data-valeur="${v}" aria-pressed="${String(periode) === v}">${t}</button>`)}</div>

    <section class="panneau" data-bloc="poids">
      <h2 class="titre-section">Poids <span class="discret">points : pesées, ligne : tendance</span></h2>
      ${serie.length >= 2 ? graphiqueLigne([
        { points: serie.map((x, i) => [i, x.poids]), type: 'points' },
        { points: serie.map((x, i) => [i, x.tendance]) },
      ], { hauteur: 150, etiquettes, titre: 'Poids et tendance', formatY: v => `${f.kg(v)} kg` }) : html`<p class="vide">Pas encore assez de pesées sur la période.</p>`}
      <p class="discret" style="margin-top:var(--space-sm)">${[taille ? `Tour de taille ${f.nombre(taille.tourTaille, 0)} cm (${court(taille.id)})` : 'Tour de taille : aucune mesure', gras ? `masse grasse ${f.nombre(gras.grasPct, 1)} % (${court(gras.id)})` : null].filter(Boolean).join(', ')}</p>
    </section>

    <section class="panneau" data-bloc="depense">
      <h2 class="titre-section">Dépense <span class="discret">mesurée chaque semaine</span></h2>
      ${depenses.some(x => x.mesuree != null) ? graphiqueLigne([
        { points: depenses.map((x, i) => [i, x.mesuree]) },
        { points: depenses.map((x, i) => [i, retenuePour(x.fin)]), classe: 'trait--2' },
      ], { hauteur: 110, etiquettes: [[0, court(depenses[0].fin)], [depenses.length - 1, court(depenses.at(-1).fin)]], titre: 'Dépense mesurée', formatY: v => `${f.kcal(v)} kcal` }) : html`<p class="vide">La dépense mesurée apparaît après 14 jours saisis et 8 pesées.</p>`}
      <p class="discret">Retenue au dernier bilan : ${f.kcal(d.reglages.depenseRetenue)} kcal/j${retenues.length ? ', en pointillés' : ''}</p>
    </section>

    <section class="panneau" data-bloc="apports">
      <h2 class="titre-section">Apports par semaine</h2>
      <div style="overflow-x:auto"><table class="tableau"><thead><tr><th>Semaine</th><th class="num">Jours</th><th class="num">kcal</th><th class="num">Prot.</th><th class="num">Fibres</th></tr></thead>
      <tbody>${[...resumes].reverse().filter(r => r.joursSaisis).map(r => html`<tr><td>${court(r.lundi)}</td><td class="num">${r.joursSaisis}</td><td class="num">${f.kcal(r.apportsMoyens)}</td><td class="num">${f.g(r.protMoyennes)} g</td><td class="num">${f.g(r.fibMoyennes)} g</td></tr>`)}</tbody></table></div>
      <p class="discret" style="margin-top:var(--space-xs)">Cibles : ${f.kcal(d.reglages.cibles.kcal)} kcal, ${d.reglages.cibles.prot} g de protéines, ${d.reglages.cibles.fib} g de fibres</p>
    </section>

    <section class="panneau" data-bloc="proteines">
      <h2 class="titre-section">Origine des protéines</h2>
      ${semainesProt.length ? html`${legendeOrigines(semainesProt)}<table class="tableau" style="margin-top:var(--space-sm)"><tbody>${semainesProt.slice().reverse().map(x => html`<tr><td style="width:5.5rem">${court(x.r.lundi)}</td><td>${barreOrigine(x.rep)}</td></tr>`)}</tbody></table>` : html`<p class="vide">Pas encore de repas sur la période.</p>`}
    </section>

    <section class="panneau" data-bloc="grignotage">
      <h2 class="titre-section">Grignotage <span class="discret">${Math.min(periode, 30)} derniers jours</span></h2>
      <p>${phraseGrignotage(gStats)}</p>
      ${gStats.nombre ? html`
        <div class="barres" style="margin-top:var(--space-md)" role="img" aria-label="Grignotages par créneau de deux heures">${Object.values(gStats.parCreneau).map(n => html`<span style="height:${Math.max(3, (n / maxCreneau) * 100)}%"></span>`)}</div>
        <div class="legende" style="justify-content:space-between"><span>0 h</span><span>12 h</span><span>24 h</span></div>
        <p class="discret" style="margin-top:var(--space-sm)">Raisons : ${RAISONS.filter(r => gStats.parRaison[r]).map(r => `${r} ${gStats.parRaison[r]}`).join(', ') || 'non précisées'}. ${gStats.topAliments.length ? `Le plus fréquent : ${gStats.topAliments[0].nom}. ` : ''}${Math.round(gStats.part * 100)} % des apports, contre ${gStats.semainePrecedente.nombre} grignotage${gStats.semainePrecedente.nombre > 1 ? 's' : ''} sur la période précédente.</p>` : ''}
    </section>

    <section data-bloc="bilans">
      <h2 class="titre-section">Bilans</h2>
      ${d.bilans.length ? html`<ul class="liste">${[...d.bilans].filter(b => b.decision).sort((a, b) => (a.id < b.id ? 1 : -1)).map(b => html`<li><a class="ligne" href="#/bilan/${b.id}" style="text-decoration:none"><span class="ligne-nom">Semaine du ${court(bornesSemaine(b.id).lundi)}<span class="ligne-detail">${{ acceptee: 'accepté', modifiee: 'modifié', refusee: 'cibles conservées' }[b.decision]}</span></span><span class="ligne-valeur">${f.kcal(b.retenues.kcal)} kcal</span></a></li>`)}</ul>` : html`<p class="vide">Ton premier bilan arrive le lundi suivant tes 14 premiers jours.</p>`}
    </section>`);

  return surActions(racine, { periode(b) { ctx.naviguer(`#/tendances/${b.dataset.valeur}`); } });
}
