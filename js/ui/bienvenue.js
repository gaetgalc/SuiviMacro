// Première ouverture (§ 12) : installation, synchronisation, profil, cibles.
import { html, monter, surActions, brut } from './composants.js';
import { FACTEURS, depenseInitiale, metabolismeBase } from '../core/depense.js';
import { proposerCibles, partGlucidesDepuis } from '../core/coach.js';
import { age } from '../core/dates.js';
import { lireQuantite } from '../core/nutrition.js';
import { creerDepot } from '../data/depot.js';

export const titre = 'Bienvenue';

export const ACTIVITES = [
  ['sedentaire', 'Sédentaire', 'peu ou pas de sport'],
  ['leger', 'Léger', '1 à 2 séances par semaine'],
  ['modere', 'Modéré', '3 à 4 séances par semaine'],
  ['eleve', 'Élevé', '5 séances ou plus'],
];

export const estInstalle = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

/** Cibles de départ proposées depuis le profil. */
export function ciblesDeDepart(profil, poids, jour) {
  const depense = depenseInitiale(profil, poids, jour);
  const mb = metabolismeBase({ sexe: profil.sexe, poidsKg: poids, tailleCm: profil.tailleCm, age: age(profil.naissance, jour) });
  const prot = Math.round(1.8 * poids);
  const r = proposerCibles({ depense, tendanceKg: poids, mb, reglages: { cibles: { prot, fib: 30 }, partGlucides: 0.6, rythmePct: 0.5 } });
  return { depense, cibles: r.cibles };
}

const etapes = (n, total = 4) => html`<div class="etapes" aria-hidden="true">${Array.from({ length: total }, (_, i) => html`<span${i <= n ? brut(' data-fait') : ''}></span>`)}</div>`;

export async function rendre(racine, params, ctx) {
  racine.dataset.ecran = 'bienvenue';
  const etat = { etape: estInstalle() ? 1 : 0, profil: { sexe: 'h', naissance: '', tailleCm: '', activite: 'modere' }, poids: '', cibles: null, depense: null, rythme: 0.5 };

  function afficher() {
    racine.dataset.etape = etat.etape;
    if (etat.etape === 0) {
      monter(racine, html`${etapes(0)}
        <h2 class="figure figure--moyenne">Installe SuiviMacro sur ton iPhone</h2>
        <p>Dans Safari, touche le bouton Partager, puis « Sur l'écran d'accueil ». Ouvre ensuite SuiviMacro depuis son icône : c'est là que tes données vivent.</p>
        <p class="discret">Une app installée a son propre stockage, séparé de Safari : configure tout depuis l'icône.</p>
        <div class="actions--pile"><button class="btn btn--primaire btn--plein" data-action="suivant">Continuer</button></div>`);
    } else if (etat.etape === 1) {
      monter(racine, html`${etapes(1)}
        <h2 class="figure figure--moyenne">Synchronisation</h2>
        <p>Colle le jeton GitHub de ton dépôt de données privé. Tes repas, pesées et réglages y seront sauvegardés et partagés entre tes appareils.</p>
        <label class="champ"><span>Jeton GitHub</span><input class="saisie" name="jeton" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
        <p class="discret" id="message-jeton" role="status"></p>
        <div class="actions--pile">
          <button class="btn btn--primaire btn--plein" data-action="jeton">Connecter</button>
          <button class="btn btn--plein" data-action="plusTard">Plus tard</button>
        </div>`);
    } else if (etat.etape === 2) {
      const p = etat.profil;
      monter(racine, html`${etapes(2)}
        <h2 class="figure figure--moyenne">Ton profil</h2>
        <p class="discret">Sert à estimer ta dépense de départ. Elle s'ajuste ensuite à tes vraies données.</p>
        <fieldset class="champ" style="border:0;padding:0;margin:0"><legend class="etiquette">Sexe</legend>
          <div class="puces">${[['h', 'Homme'], ['f', 'Femme']].map(([v, t]) => html`<button type="button" class="puce" data-action="sexe" data-valeur="${v}" aria-pressed="${p.sexe === v}">${t}</button>`)}</div></fieldset>
        <label class="champ"><span>Date de naissance</span><input class="saisie" name="naissance" type="date" value="${p.naissance}" required></label>
        <div class="rangee">
          <label class="champ"><span>Taille (cm)</span><input class="saisie" name="taille" inputmode="decimal" value="${p.tailleCm}" required></label>
          <label class="champ" style="margin-top:0"><span>Poids actuel (kg)</span><input class="saisie" name="poids" inputmode="decimal" value="${etat.poids}" required></label>
        </div>
        <label class="champ"><span>Activité</span><select class="saisie" name="activite">${ACTIVITES.map(([v, t, d]) => html`<option value="${v}"${p.activite === v ? brut(' selected') : ''}>${t}, ${d}</option>`)}</select></label>
        <p class="erreur-texte" id="erreur-profil" role="alert"></p>
        <div class="actions--pile"><button class="btn btn--primaire btn--plein" data-action="profil">Continuer</button></div>`);
    } else {
      const c = etat.cibles;
      monter(racine, html`${etapes(3)}
        <h2 class="figure figure--moyenne">Tes cibles de départ</h2>
        <p class="discret">Proposées depuis ton profil (dépense estimée ${etat.depense} kcal/j, perte de 0,5 % du poids par semaine). Remplace-les par les tiennes si tu en as.</p>
        <div class="rangee">
          <label class="champ"><span>Calories (kcal)</span><input class="saisie saisie--grande" name="kcal" inputmode="numeric" value="${c.kcal}"></label>
          <label class="champ" style="margin-top:0"><span>Protéines (g)</span><input class="saisie saisie--grande" name="prot" inputmode="numeric" value="${c.prot}"></label>
        </div>
        <div class="rangee--3 rangee" style="margin-top:var(--space-md)">
          <label class="champ"><span>Glucides (g)</span><input class="saisie" name="gluc" inputmode="numeric" value="${c.gluc}"></label>
          <label class="champ" style="margin-top:0"><span>Lipides (g)</span><input class="saisie" name="lip" inputmode="numeric" value="${c.lip}"></label>
          <label class="champ" style="margin-top:0"><span>Fibres (g)</span><input class="saisie" name="fib" inputmode="numeric" value="${c.fib}"></label>
        </div>
        <label class="champ"><span>Rythme de perte</span><select class="saisie" name="rythme">${[0.25, 0.5, 0.75, 1].map(v => html`<option value="${v}"${v === etat.rythme ? brut(' selected') : ''}>${String(v).replace('.', ',')} % du poids par semaine</option>`)}</select></label>
        <p class="erreur-texte" id="erreur-cibles" role="alert"></p>
        <div class="actions--pile"><button class="btn btn--primaire btn--plein" data-action="terminer">Commencer</button></div>`);
    }
    racine.querySelector('input, .btn--primaire')?.focus({ preventScroll: true });
  }

  const val = n => racine.querySelector(`[name="${n}"]`)?.value ?? '';

  async function terminer() {
    const jour = ctx.jour();
    const c = Object.fromEntries(['kcal', 'prot', 'gluc', 'lip', 'fib'].map(k => [k, lireQuantite(val(k))]));
    if (Object.values(c).some(v => v == null || v <= 0)) {
      racine.querySelector('#erreur-cibles').textContent = 'Renseigne les cinq cibles avec des nombres positifs.';
      return;
    }
    const cibles = { ...c, depuis: jour };
    await ctx.base.ecrire('reglages', {
      id: 'reglages', profil: etat.profil, cibles, partGlucides: partGlucidesDepuis(c),
      rythmePct: Number(val('rythme')) || 0.5, depenseRetenue: etat.depense, jourBilan: 1,
      historiqueCibles: [{ le: jour, cibles, raison: 'Cibles de départ', type: 'depart' }],
    });
    const m = (await ctx.base.lire('mesures', jour)) || { id: jour, sources: {} };
    await ctx.base.ecrire('mesures', { ...m, poids: etat.poids, sources: { ...(m.sources || {}), poids: 'manuel' } });
    ctx.naviguer('#/accueil');
  }

  const arreter = surActions(racine, {
    suivant() { etat.etape = 1; afficher(); },
    async jeton(b) {
      const jeton = val('jeton').trim();
      const msg = racine.querySelector('#message-jeton');
      if (!jeton) { msg.textContent = 'Colle ton jeton, ou choisis « Plus tard ».'; return; }
      b.setAttribute('aria-busy', 'true');
      const depot = creerDepot({ jeton });
      const t = await depot.tester();
      b.removeAttribute('aria-busy');
      if (!t.ok) { msg.textContent = t.message; msg.className = 'erreur-texte'; return; }
      await ctx.base.poserSecret('jeton', jeton);
      msg.className = 'ok-texte';
      msg.textContent = `${t.message} Récupération de tes données…`;
      const sync = await ctx.configurerSync();
      await sync.synchroniser();
      if (await ctx.reglages()) { ctx.naviguer('#/accueil'); return; }
      etat.etape = 2; afficher();
    },
    plusTard() { etat.etape = 2; afficher(); },
    sexe(b) { etat.profil.sexe = b.dataset.valeur; racine.querySelectorAll('[data-action="sexe"]').forEach(x => x.setAttribute('aria-pressed', x === b)); },
    profil() {
      const taille = lireQuantite(val('taille')), poids = lireQuantite(val('poids'));
      const naissance = val('naissance');
      const erreur = racine.querySelector('#erreur-profil');
      if (!naissance || !(taille > 100 && taille < 250) || !(poids > 30 && poids < 300)) {
        erreur.textContent = 'Vérifie la date de naissance, la taille (en cm) et le poids (en kg).';
        return;
      }
      Object.assign(etat.profil, { naissance, tailleCm: taille, activite: val('activite') || 'modere' });
      etat.poids = poids;
      const d = ciblesDeDepart(etat.profil, poids, ctx.jour());
      etat.depense = d.depense; etat.cibles = d.cibles;
      etat.etape = 3; afficher();
    },
    terminer,
  });
  afficher();
  return arreter;
}

export { FACTEURS };
