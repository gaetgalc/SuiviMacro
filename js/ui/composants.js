// Composants d'interface partagés. Tout texte inséré passe par html`` (échappé).

class Brut { constructor(s) { this.s = s; } toString() { return this.s; } }
export const brut = s => new Brut(String(s));

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function valeur(v) {
  if (v instanceof Brut) return v.s;
  if (Array.isArray(v)) return v.map(valeur).join('');
  if (v == null || v === false) return '';
  return esc(v);
}

export function html(chaines, ...vals) {
  let s = '';
  chaines.forEach((c, i) => { s += c; if (i < vals.length) s += valeur(vals[i]); });
  return new Brut(s);
}

export function monter(el, contenu) {
  el.innerHTML = valeur(contenu);
  return el;
}

/** Délégation : data-action="nom" → actions[nom](élément, évènement). */
export function surActions(racine, actions, type = 'click') {
  const h = e => {
    const cible = e.target.closest('[data-action]');
    if (!cible || !racine.contains(cible)) return;
    const fn = actions[cible.dataset.action];
    if (fn) { e.preventDefault(); fn(cible, e); }
  };
  racine.addEventListener(type, h);
  return () => racine.removeEventListener(type, h);
}

export const icone = {
  fermer: brut('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'),
  plus: brut('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'),
  retour: brut('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'),
  suivant: brut('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'),
  etoile: brut('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>'),
  poubelle: brut('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'),
};

/**
 * Feuille du bas (dialog modal). rendre(corps, api) remplit le contenu ;
 * api.fermer() la ferme. Renvoie l'api.
 */
export function feuille({ titre, rendre, surFermer, classe = '' }) {
  const d = document.createElement('dialog');
  d.className = `feuille ${classe}`;
  d.setAttribute('aria-label', titre);
  monter(d, html`<div class="poignee" aria-hidden="true"></div>
    <div class="feuille-tete"><h2>${titre}</h2><button type="button" class="btn-icone" data-fermer aria-label="Fermer">${icone.fermer}</button></div>
    <div class="feuille-corps"></div>`);
  document.body.append(d);
  const corps = d.querySelector('.feuille-corps');
  let ferme = false;
  const api = {
    element: d, corps,
    titre(t) { d.querySelector('.feuille-tete h2').textContent = t; d.setAttribute('aria-label', t); },
    fermer() {
      if (ferme) return;
      ferme = true;
      if (d.open) d.close();
      d.remove();
      surFermer?.();
    },
  };
  d.querySelector('[data-fermer]').addEventListener('click', () => api.fermer());
  d.addEventListener('close', () => api.fermer());
  d.addEventListener('click', e => { if (e.target === d) api.fermer(); });
  d.showModal();
  rendre(corps, api);
  return api;
}

export function bandeau(texte, { action, libelle = 'Annuler', duree = 5000 } = {}) {
  // Une feuille modale rend le reste de la page inerte : le bandeau va dans la feuille du dessus.
  const ouvertes = document.querySelectorAll('dialog.feuille[open]');
  const hote = ouvertes[ouvertes.length - 1];
  let zone = document.getElementById('bandeaux');
  if (hote) {
    zone = hote.querySelector(':scope > .bandeaux');
    if (!zone) { zone = document.createElement('div'); zone.className = 'bandeaux bandeaux--feuille'; zone.setAttribute('aria-live', 'polite'); hote.append(zone); }
  }
  const b = document.createElement('div');
  b.className = 'bandeau';
  b.setAttribute('role', 'status');
  monter(b, html`<span>${texte}</span>${action ? html`<button type="button">${libelle}</button>` : ''}`);
  const retirer = () => b.remove();
  if (action) b.querySelector('button').addEventListener('click', () => { retirer(); action(); });
  zone.append(b);
  if (duree) setTimeout(retirer, duree);
  return retirer;
}

export function explication(titre, lignes) {
  return feuille({
    titre,
    rendre: corps => monter(corps, html`<ul class="explication">${lignes.map(l => html`<li>${l}</li>`)}</ul>`),
  });
}

/** Niveau : nom, valeur consommée / cible, fente qui se remplit. */
export function niveau(nom, mange, cible, unite = 'g') {
  const part = cible > 0 ? Math.min(1, mange / cible) : 0;
  const depasse = cible > 0 && mange > cible * 1.02;
  return html`<div class="niveau">
    <span class="niveau-nom">${nom}</span>
    <span class="niveau-valeur">${Math.round(mange)}<small> / ${Math.round(cible)} ${unite}</small></span>
    <span class="fente"${depasse ? brut(' data-depasse') : ''}><span style="--part:${part.toFixed(3)}"></span></span>
  </div>`;
}

/**
 * Graphique de lignes en SVG. series : [{ points: [[x, y|null]], classe, type: 'ligne'|'points' }].
 * x numériques (index de jour). Retourne du html brut.
 */
export function graphiqueLigne(series, { largeur = 340, hauteur = 120, marge = 4, etiquettes = null, yMin, yMax, titre = '', formatY = null } = {}) {
  const tous = series.flatMap(s => s.points.filter(p => p[1] != null));
  if (!tous.length) return html``;
  const xs = tous.map(p => p[0]), ys = tous.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = yMin ?? Math.min(...ys), y1 = yMax ?? Math.max(...ys);
  if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
  const bas = etiquettes ? 14 : 0;
  const droite = formatY ? 52 : 0; // place des valeurs de l'axe, hors du tracé
  const X = x => marge + ((x - x0) / Math.max(1, x1 - x0)) * (largeur - droite - 2 * marge);
  const Y = y => marge + (1 - (y - y0) / (y1 - y0)) * (hauteur - bas - 2 * marge);
  const morceaux = series.map(s => {
    if (s.type === 'points') return s.points.filter(p => p[1] != null).map(p => `<circle class="point" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2"/>`).join('');
    let d = '', lever = true;
    for (const [x, y] of s.points) {
      if (y == null) { lever = true; continue; }
      d += `${lever ? 'M' : 'L'}${X(x).toFixed(1)} ${Y(y).toFixed(1)} `;
      lever = false;
    }
    return `<path class="trait ${s.classe || ''}" d="${d.trim()}"/>`;
  }).join('');
  const yVals = formatY ? [Math.min(...ys), Math.max(...ys)].map(v => `<text x="${largeur}" y="${(Y(v) + (v === Math.max(...ys) ? 9 : -3)).toFixed(1)}" text-anchor="end">${esc(formatY(v))}</text>`).join('') : '';
  const lab = etiquettes ? etiquettes.map(([x, t]) => [Math.min(Math.max(x, x0), x1), t]).map(([x, t]) => `<text x="${X(x).toFixed(1)}" y="${hauteur - 2}" text-anchor="${x === x0 ? 'start' : x === x1 ? 'end' : 'middle'}">${esc(t)}</text>`).join('') : '';
  return brut(`<svg class="graphique" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="${esc(titre)}"><line class="grille" x1="0" x2="${largeur}" y1="${hauteur - bas - marge}" y2="${hauteur - bas - marge}"/>${morceaux}${lab}${yVals}</svg>`);
}

export function chargement(lignes = 3) {
  return html`<div aria-busy="true" aria-label="Chargement">${Array.from({ length: lignes }, () => html`<span class="squelette" style="margin:12px 0"></span>`)}</div>`;
}

export function erreurBloc(texte, action) {
  return html`<div class="alerte alerte--erreur" role="alert"><p>${texte}</p>${action || ''}</div>`;
}

/** Attend qu'un champ texte se stabilise (frappe). */
export function temporiser(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
