// Saisie en phrase (§ 10.4) et photo (§ 10.5). Rien n'est ajouté avant « Valider ».
import { html, monter, surActions, feuille, bandeau, brut } from './composants.js';
import { analyserPhrase, consigneClaude, extraireJson, lignesDepuisJson, resoudre } from '../core/phrase.js';
import { valeurs, lireQuantite } from '../core/nutrition.js';
import { heureLocale } from '../core/dates.js';
import { ajouterEntree, annuler } from '../data/aliments.js';
import { creerIa, chargerAnthropic, reduireImage, IaRefus, IaCle } from '../data/ia.js';
import * as f from '../core/format.js';

const SEUIL_CONFIANCE = 0.75;

const nomUnite = (a, u) => (u === 'g' || u === 'ml' ? u : a?.portions?.find(p => p.id === u)?.nom || u);

/** Liste éditable des lignes reconnues ; renvoie { dessiner, valider }. */
function listeLignes(ctx, corps, { jour, repas, mode, api, surFin }) {
  let lignes = [];
  const zone = corps.querySelector('[data-lignes]');
  function dessiner(nouvelles) {
    if (nouvelles) lignes = nouvelles.map(l => ({ ...l, choisi: 0, ...resoudre(l) }));
    if (!lignes.length) { monter(zone, html`<p class="vide">Rien de reconnu pour l'instant.</p>`); return; }
    monter(zone, html`<ul class="liste">${lignes.map((l, i) => {
      const a = l.choix[l.choisi];
      const kcal = a ? valeurs(a, l.qte, l.unite).kcal : null;
      const doute = l.confiance < SEUIL_CONFIANCE || !a;
      return html`<li class="${doute ? 'surligne' : ''}" style="padding:var(--space-sm) 0">
        <p class="discret">« ${l.segment} »${doute ? ' : à vérifier' : ''}</p>
        ${a ? html`
          ${l.choix.length > 1 ? html`<select class="saisie" name="choix-${i}" aria-label="Aliment reconnu">${l.choix.map((c, k) => html`<option value="${k}"${k === l.choisi ? brut(' selected') : ''}>${c.nom}</option>`)}</select>` : html`<p>${a.nom}</p>`}
          <div class="rangee" style="margin-top:var(--space-xs);align-items:center">
            <label class="champ"><span>Quantité (${nomUnite(a, l.unite)})</span><input class="saisie" name="qte-${i}" inputmode="decimal" value="${String(l.qte).replace('.', ',')}"></label>
            <div class="actions" style="justify-content:flex-end;align-items:center"><span class="ligne-valeur">${kcal == null ? '' : `${f.kcal(kcal)} kcal`}</span><button type="button" class="btn-icone" data-action="retirerLigne" data-i="${i}" aria-label="Retirer cette ligne">×</button></div>
          </div>` : html`<p class="erreur-texte">Aucun aliment trouvé. Reformule, crée l'aliment ou demande à Claude.</p>`}
      </li>`;
    })}</ul>`);
  }
  corps.addEventListener('change', e => {
    const m = e.target.name?.match(/^(choix|qte)-(\d+)$/);
    if (!m) return;
    const l = lignes[Number(m[2])];
    if (m[1] === 'choix') {
      l.choisi = Number(e.target.value);
      const a = l.choix[l.choisi];
      if (!(l.unite === 'g' || l.unite === 'ml' || a.portions?.some(p => p.id === l.unite))) { l.unite = a.portions?.[0]?.id || 'g'; l.qte = l.unite === 'g' ? 100 : 1; }
    } else {
      const q = lireQuantite(e.target.value);
      if (q > 0) l.qte = q;
    }
    dessiner();
  });
  return {
    dessiner,
    retirer(i) { lignes.splice(i, 1); dessiner(); },
    async valider() {
      const valides = lignes.filter(l => l.choix[l.choisi] && l.qte > 0);
      if (!valides.length) return false;
      const ajoutees = [];
      for (const l of valides) {
        ajoutees.push(await ajouterEntree(ctx.base, { aliment: l.choix[l.choisi], qte: l.qte, unite: l.unite, jour, repas, heure: heureLocale(ctx.maintenant()), mode }));
      }
      for (const e of ajoutees) { const a = await ctx.base.lire('aliments', e.alimentId); if (a) await ctx.rafraichirIndex(a); }
      api.fermer();
      surFin?.();
      bandeau(`${ajoutees.length} aliment${ajoutees.length > 1 ? 's' : ''} ajouté${ajoutees.length > 1 ? 's' : ''}`, { action: () => annuler(ctx.base, ajoutees.map(e => e.id)) });
      return true;
    },
  };
}

function messageIa(e) {
  if (e instanceof IaRefus) return 'Claude a refusé cette demande. Utilise l\'analyse sans IA ou reformule.';
  if (e instanceof IaCle) return 'Ta clé API est refusée : vérifie-la dans les réglages.';
  return `${e.message} L'analyse sans IA reste disponible.`;
}

export async function ouvrirPhrase(ctx, { jour, repas, texte = '', surFin }) {
  const cle = await ctx.base.secret('cleApi');
  return feuille({
    titre: 'En une phrase',
    rendre(corps, api) {
      monter(corps, html`
        <label class="champ"><span>Ce que tu as mangé</span><textarea class="saisie" name="phrase" placeholder="curry pois chiches riz, grosse portion et un skyr">${texte}</textarea></label>
        <div class="actions">
          <button type="button" class="btn${cle ? '' : ' btn--primaire'}" data-action="analyser">Analyser</button>
          ${cle ? html`<button type="button" class="btn btn--primaire" data-action="claude">Estimer avec Claude</button>` : html`<button type="button" class="btn" data-action="copier">Demander à Claude</button>`}
        </div>
        ${cle ? '' : html`<details><summary class="discret" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Coller la réponse de Claude</summary>
          <p class="discret">« Demander à Claude » copie une demande : colle-la dans l'app Claude, puis colle sa réponse ici.</p>
          <textarea class="saisie" name="reponse" aria-label="Réponse de Claude"></textarea>
          <button type="button" class="btn" data-action="lireReponse" style="margin-top:var(--space-sm)">Lire la réponse</button>
        </details>`}
        <p class="erreur-texte" role="alert" data-erreur></p>
        <div data-lignes aria-live="polite"></div>
        <button type="button" class="btn btn--primaire btn--plein" data-action="validerPhrase">Valider</button>`);
      const liste = listeLignes(ctx, corps, { jour, repas, mode: 'phrase', api, surFin });
      const erreur = corps.querySelector('[data-erreur]');
      const phrase = () => corps.querySelector('[name="phrase"]').value.trim();
      surActions(corps, {
        async analyser() {
          erreur.textContent = '';
          if (!phrase()) { erreur.textContent = 'Écris ce que tu as mangé.'; return; }
          const { portions } = await ctx.donnees();
          liste.dessiner(analyserPhrase(phrase(), await ctx.index(), portions));
        },
        async claude(b) {
          erreur.textContent = '';
          if (!phrase()) { erreur.textContent = 'Écris ce que tu as mangé.'; return; }
          b.setAttribute('aria-busy', 'true');
          try {
            const ia = creerIa({ cle, Anthropic: await chargerAnthropic() });
              liste.dessiner(await ia.estimerPhrase(phrase()));
          } catch (e) { erreur.textContent = messageIa(e); } finally { b.removeAttribute('aria-busy'); }
        },
        async copier() {
          if (!phrase()) { erreur.textContent = 'Écris ce que tu as mangé.'; return; }
          try { await navigator.clipboard.writeText(consigneClaude(phrase())); bandeau('Demande copiée : colle-la dans l\'app Claude.'); } catch { erreur.textContent = 'Copie impossible ici.'; }
          corps.querySelector('details').open = true;
        },
        lireReponse() {
          const obj = extraireJson(corps.querySelector('[name="reponse"]').value);
          const lignes = obj ? lignesDepuisJson(obj, 'ia') : [];
          if (!lignes.length) { erreur.textContent = 'Je ne trouve pas de liste d\'aliments dans cette réponse.'; return; }
          erreur.textContent = '';
          liste.dessiner(lignes);
        },
        retirerLigne(b) { liste.retirer(Number(b.dataset.i)); },
        async validerPhrase() { if (!(await liste.valider())) erreur.textContent = 'Rien à ajouter : analyse d\'abord une phrase.'; },
      });
      corps.querySelector('[name="phrase"]').focus();
    },
  });
}

export async function ouvrirPhoto(ctx, { jour, repas, surFin }) {
  const cle = await ctx.base.secret('cleApi');
  return feuille({
    titre: 'Photo du repas',
    rendre(corps, api) {
      monter(corps, html`
        <p class="discret">Claude estime chaque élément visible. Tu corriges avant de valider.</p>
        <label class="btn btn--primaire btn--plein">Prendre une photo<input type="file" accept="image/*" capture="environment" class="visually-hidden" data-photo></label>
        <p class="discret" role="status" data-etat></p>
        <p class="erreur-texte" role="alert" data-erreur></p>
        <div data-lignes aria-live="polite"></div>
        <button type="button" class="btn btn--plein" data-action="validerPhrase">Valider</button>`);
      const liste = listeLignes(ctx, corps, { jour, repas, mode: 'photo', api, surFin });
      const etat = corps.querySelector('[data-etat]'), erreur = corps.querySelector('[data-erreur]');
      corps.querySelector('[data-photo]').addEventListener('change', async e => {
        const fichier = e.target.files?.[0];
        if (!fichier) return;
        erreur.textContent = '';
        etat.textContent = 'Claude regarde la photo…';
        try {
          const { base64, type } = await reduireImage(fichier);
          const ia = creerIa({ cle, Anthropic: await chargerAnthropic() });
          liste.dessiner(await ia.estimerPhoto(base64, type));
          etat.textContent = '';
        } catch (err) { etat.textContent = ''; erreur.textContent = messageIa(err); }
      });
      surActions(corps, {
        retirerLigne(b) { liste.retirer(Number(b.dataset.i)); },
        async validerPhrase() { if (!(await liste.valider())) erreur.textContent = 'Prends d\'abord une photo.'; },
      });
    },
  });
}
