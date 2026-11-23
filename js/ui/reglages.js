// Réglages (§ 12) : profil, cibles, synchronisation, IA, raccourci, aliments, données, à propos.
import { html, monter, surActions, brut, bandeau, feuille } from './composants.js';
import { ACTIVITES } from './bienvenue.js';
import { lireQuantite } from '../core/nutrition.js';
import { partGlucidesDepuis } from '../core/coach.js';
import { ecartJours } from '../core/dates.js';
import { creerDepot } from '../data/depot.js';
import { creerIa, chargerAnthropic } from '../data/ia.js';

export const titre = 'Réglages';

export const EXEMPLE_ENVOI = {
  version: 1, envoye: '2026-11-24T07:05:00+01:00',
  poids: [{ date: '2026-11-24T06:58:00+01:00', kg: '80,2' }],
  gras: [{ date: '2026-11-24T06:58:00+01:00', pct: '18,4' }],
  seances: [{ debut: '2026-11-23T19:00:00+01:00', fin: '2026-11-23T20:30:00+01:00', type: 'Football', dureeMin: 90, kcal: '720' }],
};

const dateFr = iso => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais');
const jourFr = j => new Date(`${j}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Jours avant expiration du jeton, ou null. */
export async function joursAvantExpiration(ctx) {
  const exp = await ctx.base.secret('jetonExpire');
  return exp ? ecartJours(ctx.jour(), exp) : null;
}

export async function rendre(racine, params, ctx) {
  racine.dataset.ecran = 'reglages';
  if (params[0] === 'aliments') {
    const { rendreMesAliments } = await import('./aliment.js');
    return rendreMesAliments(racine, ctx);
  }
  const r = await ctx.reglages();
  const jeton = await ctx.base.secret('jeton');
  const cle = await ctx.base.secret('cleApi');
  const expire = await ctx.base.secret('jetonExpire');
  const restants = await joursAvantExpiration(ctx);
  const etatSync = ctx.sync?.etat();
  const envoi = etatSync?.dernierEnvoi;
  const p = r.profil, c = r.cibles;

  monter(racine, html`
  <section id="profil" class="panneau">
    <h2 class="titre-section">Profil</h2>
    <form data-form="profil">
      <div class="puces">${[['h', 'Homme'], ['f', 'Femme']].map(([v, t]) => html`<button type="button" class="puce" data-action="sexe" data-valeur="${v}" aria-pressed="${p.sexe === v}">${t}</button>`)}</div>
      <label class="champ"><span>Date de naissance</span><input class="saisie" name="naissance" type="date" value="${p.naissance}"></label>
      <label class="champ"><span>Taille (cm)</span><input class="saisie" name="taille" inputmode="decimal" value="${p.tailleCm}"></label>
      <label class="champ"><span>Activité</span><select class="saisie" name="activite">${ACTIVITES.map(([v, t, d]) => html`<option value="${v}"${p.activite === v ? brut(' selected') : ''}>${t}, ${d}</option>`)}</select></label>
      <div class="actions" style="margin-top:var(--space-md)"><button class="btn" data-action="profil">Enregistrer le profil</button></div>
    </form>
  </section>

  <section id="cibles" class="panneau">
    <h2 class="titre-section">Cibles <span class="discret">depuis le ${jourFr(c.depuis)}</span></h2>
    <div class="rangee">
      <label class="champ"><span>Calories (kcal)</span><input class="saisie" name="kcal" inputmode="numeric" value="${c.kcal}"></label>
      <label class="champ" style="margin-top:0"><span>Protéines (g)</span><input class="saisie" name="prot" inputmode="numeric" value="${c.prot}"></label>
    </div>
    <div class="rangee rangee--3" style="margin-top:var(--space-md)">
      <label class="champ"><span>Glucides (g)</span><input class="saisie" name="gluc" inputmode="numeric" value="${c.gluc}"></label>
      <label class="champ" style="margin-top:0"><span>Lipides (g)</span><input class="saisie" name="lip" inputmode="numeric" value="${c.lip}"></label>
      <label class="champ" style="margin-top:0"><span>Fibres (g)</span><input class="saisie" name="fib" inputmode="numeric" value="${c.fib}"></label>
    </div>
    <label class="champ"><span>Raison du changement (facultatif)</span><input class="saisie" name="raison" placeholder="ex. reprise du sport"></label>
    <div class="rangee" style="margin-top:var(--space-md)">
      <label class="champ"><span>Rythme</span><select class="saisie" name="rythme">${[0.25, 0.5, 0.75, 1].map(v => html`<option value="${v}"${v === r.rythmePct ? brut(' selected') : ''}>${String(v).replace('.', ',')} %/semaine</option>`)}</select></label>
      <label class="champ" style="margin-top:0"><span>Jour du bilan</span><select class="saisie" name="jourBilan">${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map((j, i) => html`<option value="${i + 1}"${i + 1 === r.jourBilan ? brut(' selected') : ''}>${j}</option>`)}</select></label>
    </div>
    <p class="erreur-texte" id="erreur-cibles" role="alert"></p>
    <div class="actions" style="margin-top:var(--space-md)"><button class="btn" data-action="cibles">Enregistrer les cibles</button></div>
    <h3 style="margin-top:var(--space-lg)">Historique</h3>
    <ul class="liste">${[...(r.historiqueCibles || [])].reverse().map(h => html`<li class="ligne" style="cursor:default"><span class="ligne-nom">${jourFr(h.le)}<span class="ligne-detail">${h.raison || (h.type === 'bilan' ? 'Bilan hebdomadaire' : 'Modification manuelle')}</span></span><span class="ligne-valeur">${h.cibles.kcal} kcal, P ${h.cibles.prot} g</span></li>`)}</ul>
  </section>

  <section id="synchronisation" class="panneau">
    <h2 class="titre-section">Synchronisation</h2>
    ${restants != null && restants <= 14 ? html`<div class="alerte" role="alert"><p>${restants < 0 ? 'Ton jeton GitHub a expiré.' : `Ton jeton GitHub expire dans ${restants} jour${restants > 1 ? 's' : ''}.`} Crée-en un nouveau et colle-le ici.</p></div>` : ''}
    <p class="discret">${jeton ? html`Connecté au dépôt privé. Dernière réception : ${dateFr(etatSync?.derniereReception)}. ${etatSync?.enAttente ? `${etatSync.enAttente} fichier(s) en attente d'envoi.` : 'Tout est envoyé.'}` : 'Pas encore de jeton : tes données restent sur cet appareil.'}</p>
    ${etatSync?.erreur ? html`<p class="erreur-texte">${{ jeton: 'GitHub refuse le jeton : il a peut-être expiré.', reseau: 'Pas de connexion pour l\'instant ; les modifications partiront au retour du réseau.' }[etatSync.erreur] || `Erreur : ${etatSync.message || etatSync.erreur}`}</p>` : ''}
    <label class="champ"><span>Jeton GitHub</span><input class="saisie" name="jeton" type="password" autocomplete="off" spellcheck="false" placeholder="${jeton ? 'enregistré, colle un nouveau jeton pour le remplacer' : 'github_pat_…'}"></label>
    <label class="champ"><span>Date d'expiration (facultatif)</span><input class="saisie" name="jetonExpire" type="date" value="${expire || ''}"></label>
    <p id="message-jeton" class="discret" role="status"></p>
    <div class="actions" style="margin-top:var(--space-md)">
      <button class="btn" data-action="jeton">Tester et enregistrer</button>
      ${jeton ? html`<button class="btn" data-action="synchroniser">Synchroniser maintenant</button><button class="btn btn--danger" data-action="oublierJeton">Retirer le jeton</button>` : ''}
    </div>
  </section>

  <section id="ia" class="panneau">
    <h2 class="titre-section">Claude (facultatif)</h2>
    <p class="discret">Avec une clé API Anthropic, la saisie en phrase part directement à Claude et la photo d'un repas devient possible. La clé reste sur cet appareil. Facturée à part de l'abonnement Claude Pro.</p>
    <label class="champ"><span>Clé API</span><input class="saisie" name="cleApi" type="password" autocomplete="off" spellcheck="false" placeholder="${cle ? 'enregistrée' : 'sk-ant-…'}"></label>
    <p id="message-cle" class="discret" role="status"></p>
    <div class="actions" style="margin-top:var(--space-md)"><button class="btn" data-action="cle">Tester et enregistrer</button>${cle ? html`<button class="btn btn--danger" data-action="oublierCle">Retirer la clé</button>` : ''}</div>
  </section>

  <section id="raccourci" class="panneau">
    <h2 class="titre-section">Raccourci iPhone</h2>
    <p>Dernier envoi intégré : ${envoi ? html`${dateFr(envoi.le)}, ${envoi.resume.poids} poids, ${envoi.resume.gras} % de gras, ${envoi.resume.seances} séance(s)${envoi.resume.ignores ? `, ${envoi.resume.ignores} valeur(s) ignorée(s)` : ''}.` : 'aucun pour l\'instant.'}</p>
    ${envoi?.erreur ? html`<p class="erreur-texte">${envoi.erreur}</p>` : ''}
    <p class="discret">Le raccourci dépose un fichier JSON dans le dossier inbox du dépôt de données. Format attendu :</p>
    <pre class="lit" style="overflow-x:auto;font-size:var(--text-xs);white-space:pre">${JSON.stringify(EXEMPLE_ENVOI, null, 1)}</pre>
    <div class="actions"><button class="btn" data-action="copierExemple">Copier un exemple</button><a class="btn" href="https://github.com/gaetgalc/SuiviMacro/blob/main/docs/GUIDE.md" target="_blank" rel="noopener">Guide pas à pas</a></div>
  </section>

  <section class="panneau">
    <h2 class="titre-section">Mes aliments</h2>
    <p class="discret">Aliments créés, recettes et repas enregistrés.</p>
    <div class="actions" style="margin-top:var(--space-sm)"><a class="btn" href="#/reglages/aliments">Gérer mes aliments</a></div>
  </section>

  <section id="donnees" class="panneau">
    <h2 class="titre-section">Données</h2>
    <p class="discret">L'export contient tout (sauf le jeton et la clé). L'import fusionne : il n'efface jamais rien.</p>
    <div class="actions" style="margin-top:var(--space-sm)">
      <button class="btn" data-action="exporter">Exporter</button>
      <label class="btn">Importer<input type="file" accept="application/json,.json" data-importer class="visually-hidden"></label>
    </div>
    <p id="message-donnees" class="discret" role="status"></p>
  </section>

  <section id="apropos" class="panneau">
    <h2 class="titre-section">À propos</h2>
    <p>Aliments bruts : table Ciqual 2025 de l'ANSES (licence CC-BY 4.0). Produits : Open Food Facts (licence ODbL), données collaboratives. Valeurs des plats types : estimations.</p>
    <p class="discret" style="margin-top:var(--space-xs)">SuiviMacro, outil personnel. Polices Instrument Sans et Figtree (OFL), lecture de codes-barres ZXing (Apache 2.0).</p>
  </section>`);

  if (params[0]) racine.querySelector(`#${CSS.escape(params[0])}`)?.scrollIntoView();
  const val = n => racine.querySelector(`[name="${n}"]`)?.value ?? '';
  let sexe = p.sexe;

  async function majReglages(modif) {
    const actuel = await ctx.reglages();
    await ctx.base.ecrire('reglages', { ...actuel, ...modif(actuel) });
  }

  const arreter = surActions(racine, {
    sexe(b) { sexe = b.dataset.valeur; racine.querySelectorAll('[data-action="sexe"]').forEach(x => x.setAttribute('aria-pressed', x === b)); },
    async profil() {
      const taille = lireQuantite(val('taille'));
      if (!(taille > 100 && taille < 250) || !val('naissance')) { bandeau('Vérifie la taille et la date de naissance.'); return; }
      await majReglages(a => ({ profil: { ...a.profil, sexe, naissance: val('naissance'), tailleCm: taille, activite: val('activite') } }));
      bandeau('Profil enregistré.');
    },
    async cibles() {
      const n = Object.fromEntries(['kcal', 'prot', 'gluc', 'lip', 'fib'].map(k => [k, lireQuantite(val(k))]));
      if (Object.values(n).some(v => v == null || v <= 0)) { racine.querySelector('#erreur-cibles').textContent = 'Les cinq cibles doivent être des nombres positifs.'; return; }
      const jour = ctx.jour();
      await majReglages(a => {
        const change = ['kcal', 'prot', 'gluc', 'lip', 'fib'].some(k => a.cibles[k] !== n[k]);
        const cibles = change ? { ...n, depuis: jour } : a.cibles;
        return {
          cibles, rythmePct: Number(val('rythme')), jourBilan: Number(val('jourBilan')),
          partGlucides: change ? partGlucidesDepuis(n) : a.partGlucides,
          historiqueCibles: change ? [...(a.historiqueCibles || []), { le: jour, cibles, raison: val('raison').trim() || null, type: 'manuel' }] : a.historiqueCibles,
        };
      });
      bandeau('Cibles enregistrées.');
    },
    async jeton(b) {
      const msg = racine.querySelector('#message-jeton');
      const nouveau = val('jeton').trim() || (await ctx.base.secret('jeton'));
      await ctx.base.poserSecret('jetonExpire', val('jetonExpire') || null);
      if (!nouveau) { msg.textContent = 'Colle un jeton.'; return; }
      b.setAttribute('aria-busy', 'true');
      const t = await creerDepot({ jeton: nouveau }).tester();
      b.removeAttribute('aria-busy');
      msg.textContent = t.message;
      msg.className = t.ok ? 'ok-texte' : 'erreur-texte';
      if (t.ok) {
        await ctx.base.poserSecret('jeton', nouveau);
        const s = await ctx.configurerSync();
        await s?.synchroniser();
        bandeau(t.message);
        ctx.naviguer('#/reglages/synchronisation');
      }
    },
    async synchroniser(b) {
      b.setAttribute('aria-busy', 'true');
      await ctx.sync?.synchroniser();
      ctx.naviguer('#/reglages/synchronisation');
    },
    async oublierJeton() {
      await ctx.base.poserSecret('jeton', null);
      await ctx.configurerSync();
      ctx.naviguer('#/reglages/synchronisation');
    },
    async cle(b) {
      const msg = racine.querySelector('#message-cle');
      const nouvelle = val('cleApi').trim() || (await ctx.base.secret('cleApi'));
      if (!nouvelle) { msg.textContent = 'Colle une clé.'; return; }
      b.setAttribute('aria-busy', 'true');
      let t;
      try { t = await creerIa({ cle: nouvelle, Anthropic: await chargerAnthropic() }).tester(); } catch (e) { t = { ok: false, message: e.message }; }
      b.removeAttribute('aria-busy');
      msg.textContent = t.message;
      msg.className = t.ok ? 'ok-texte' : 'erreur-texte';
      if (t.ok) { await ctx.base.poserSecret('cleApi', nouvelle); ctx.naviguer('#/reglages/ia'); }
    },
    async oublierCle() { await ctx.base.poserSecret('cleApi', null); ctx.naviguer('#/reglages/ia'); },
    async copierExemple() {
      try { await navigator.clipboard.writeText(JSON.stringify(EXEMPLE_ENVOI, null, 1)); bandeau('Exemple copié.'); } catch { bandeau('Copie impossible ici.'); }
    },
    async exporter() {
      const donnees = await ctx.base.exporter();
      const blob = new Blob([JSON.stringify(donnees, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `suivimacro-${ctx.jour()}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  });
  const importer = async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const msg = racine.querySelector('#message-donnees');
    try {
      const obj = JSON.parse(await f.text());
      if (obj?.application !== 'SuiviMacro') throw new Error('ce fichier n\'est pas un export SuiviMacro');
      const n = await ctx.base.importer(obj);
      msg.className = 'ok-texte';
      msg.textContent = `Import terminé (${n} fichier(s) de données fusionnés).`;
    } catch (err) {
      msg.className = 'erreur-texte';
      msg.textContent = `Import impossible : ${err.message}.`;
    }
  };
  racine.querySelector('[data-importer]').addEventListener('change', importer);
  return arreter;
}

export { feuille };
