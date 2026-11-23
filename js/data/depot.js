// Client minimal de l'API GitHub pour le dépôt de données privé.

export class ConflitDepot extends Error {}
export class JetonRefuse extends Error {}
export class HorsLigne extends Error {}
export class ErreurDepot extends Error {}

export function encoder(texte) {
  const octets = new TextEncoder().encode(texte);
  let bin = '';
  for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function decoder(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

const cheminUrl = c => c.split('/').map(encodeURIComponent).join('/');

export function creerDepot({ jeton, proprietaire = 'gaetgalc', nom = 'SuiviMacro-data', branche = 'main', fetch = globalThis.fetch.bind(globalThis) }) {
  const racine = `https://api.github.com/repos/${proprietaire}/${nom}`;

  async function appel(chemin, { methode = 'GET', corps } = {}) {
    let r;
    try {
      r = await fetch(racine + chemin, {
        method: methode, cache: 'no-store',
        headers: {
          Authorization: `Bearer ${jeton}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
          ...(corps ? { 'Content-Type': 'application/json' } : {}),
        },
        body: corps ? JSON.stringify(corps) : undefined,
      });
    } catch (e) {
      throw new HorsLigne(e.message);
    }
    if (r.status === 401 || r.status === 403) throw new JetonRefuse(`HTTP ${r.status}`);
    if (r.status === 409 || r.status === 422) throw new ConflitDepot(`HTTP ${r.status}`);
    return r;
  }

  const depot = {
    async arbre() {
      let r;
      try {
        r = await appel(`/git/trees/${branche}?recursive=1`);
      } catch (e) {
        if (e instanceof ConflitDepot) return new Map(); // dépôt vide
        throw e;
      }
      if (r.status === 404) return new Map();
      if (!r.ok) throw new ErreurDepot(`arbre : HTTP ${r.status}`);
      const j = await r.json();
      return new Map(j.tree.filter(x => x.type === 'blob').map(x => [x.path, x.sha]));
    },
    async lire(chemin) {
      const r = await appel(`/contents/${cheminUrl(chemin)}?ref=${branche}`);
      if (r.status === 404) return null;
      if (!r.ok) throw new ErreurDepot(`lire ${chemin} : HTTP ${r.status}`);
      const j = await r.json();
      if (j.encoding === 'none' || (!j.content && j.size > 0)) {
        // Au-delà de 1 Mo, l'API contents ne renvoie pas le contenu : passer par le blob.
        const b = await appel(`/git/blobs/${j.sha}`);
        if (!b.ok) throw new ErreurDepot(`lire ${chemin} (blob) : HTTP ${b.status}`);
        return { texte: decoder((await b.json()).content), sha: j.sha };
      }
      return { texte: decoder(j.content), sha: j.sha };
    },
    async ecrire(chemin, texte, sha) {
      const r = await appel(`/contents/${cheminUrl(chemin)}`, {
        methode: 'PUT', corps: { message: `SuiviMacro : ${chemin}`, content: encoder(texte), branch: branche, ...(sha ? { sha } : {}) },
      });
      if (!r.ok) throw new ErreurDepot(`écrire ${chemin} : HTTP ${r.status}`);
      return (await r.json()).content.sha;
    },
    async supprimer(chemin, sha) {
      const r = await appel(`/contents/${cheminUrl(chemin)}`, { methode: 'DELETE', corps: { message: `SuiviMacro : intégré ${chemin}`, sha, branch: branche } });
      if (!r.ok && r.status !== 404) throw new ErreurDepot(`supprimer ${chemin} : HTTP ${r.status}`);
    },
    async tester() {
      try {
        const r = await appel('');
        if (r.status === 404) return { ok: false, message: `Dépôt ${proprietaire}/${nom} introuvable avec ce jeton.` };
        if (!r.ok) return { ok: false, message: `Réponse inattendue de GitHub (HTTP ${r.status}).` };
        return { ok: true, message: `Connecté à ${proprietaire}/${nom}.` };
      } catch (e) {
        if (e instanceof JetonRefuse) return { ok: false, message: 'Jeton refusé par GitHub (expiré ou sans accès au dépôt).' };
        if (e instanceof HorsLigne) return { ok: false, message: 'Pas de connexion à GitHub.' };
        return { ok: false, message: e.message };
      }
    },
  };
  return depot;
}
