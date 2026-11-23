// Code-barres (§ 10.3) : caméra arrière, repli par saisie ou photo du code.
import { html, monter, surActions, feuille } from './composants.js';
import { ouvrirQuantite } from './quantite.js';
import { codeValide, decoderSource } from '../data/codebarre.js';
import { creerOff } from '../data/off.js';

const chargerZxing = () => import('../../vendor/zxing.js');

/** Aliment déjà connu (créé ou produit déjà utilisé), sinon Open Food Facts. */
export async function trouverCode(ctx, code) {
  const connu = (await ctx.base.tous('aliments')).find(a => a.ref === code);
  if (connu) return connu;
  return creerOff({ base: ctx.base }).produit(code);
}

export function ouvrirScanner(ctx, { jour, repas, surFin }) {
  let flux = null, minuterie = null, trouve = false;
  const arreter = () => { clearInterval(minuterie); flux?.getTracks().forEach(t => t.stop()); flux = null; };

  return feuille({
    titre: 'Code-barres',
    surFermer: () => { arreter(); if (!trouve) surFin?.(); },
    rendre(corps, api) {
      monter(corps, html`
        <div class="visee" data-visee><video playsinline muted autoplay aria-label="Caméra"></video></div>
        <p class="discret" data-etat role="status">Ouverture de la caméra…</p>
        <div class="rangee" style="align-items:end">
          <label class="champ"><span>Saisir le code</span><input class="saisie" name="code" inputmode="numeric" autocomplete="off" placeholder="3017620422003"></label>
          <button type="button" class="btn" data-action="chercherCode">Chercher</button>
        </div>
        <label class="btn btn--plein" data-photo-code>Prendre une photo du code<input type="file" accept="image/*" capture="environment" class="visually-hidden"></label>
        <p class="erreur-texte" role="alert" data-erreur></p>`);
      const etat = corps.querySelector('[data-etat]');
      const erreur = corps.querySelector('[data-erreur]');

      async function traiter(code) {
        if (trouve) return;
        erreur.textContent = '';
        etat.textContent = `Code ${code} : recherche…`;
        let a;
        try { a = await trouverCode(ctx, code); } catch { a = undefined; }
        if (a === undefined) { erreur.textContent = 'Open Food Facts ne répond pas. Réessaie, ou crée l\'aliment.'; return; }
        trouve = true;
        arreter();
        api.fermer();
        if (!a || a.incomplet) {
          const { ouvrirCreation } = await import('./aliment.js');
          ouvrirCreation(ctx, { nom: a?.nom?.startsWith('Produit ') ? '' : a?.nom || '', code, surCree: x => ouvrirQuantite(ctx, x, { jour, repas, surFin }) });
          return;
        }
        ouvrirQuantite(ctx, { ...a, mode: 'code' }, { jour, repas, surFin });
      }

      async function camera() {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('indisponible');
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        const video = corps.querySelector('video');
        video.srcObject = flux;
        await video.play();
        const zxing = await chargerZxing();
        etat.textContent = 'Vise le code-barres.';
        minuterie = setInterval(() => {
          const code = decoderSource(video, zxing, 800);
          if (code) traiter(code);
        }, 350);
      }

      camera().catch(() => {
        corps.querySelector('[data-visee]').hidden = true;
        etat.textContent = 'Caméra indisponible : saisis le code ou prends-le en photo.';
      });

      corps.querySelector('[data-photo-code] input').addEventListener('change', async e => {
        const fichier = e.target.files?.[0];
        if (!fichier) return;
        etat.textContent = 'Lecture de la photo…';
        const [zxing, image] = await Promise.all([chargerZxing(), createImageBitmap(fichier)]);
        const code = decoderSource(image, zxing, 1600);
        if (code) traiter(code);
        else { etat.textContent = ''; erreur.textContent = 'Aucun code lisible sur la photo. Rapproche-toi, ou saisis le code.'; }
      });
      surActions(corps, {
        chercherCode() {
          const code = codeValide(corps.querySelector('[name="code"]').value);
          if (!code) { erreur.textContent = 'Un code-barres compte 8 à 14 chiffres.'; return; }
          traiter(code);
        },
      });
    },
  });
}
