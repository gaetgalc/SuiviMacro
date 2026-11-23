// Faux GitHub en mémoire : git/trees, contents (GET/PUT/DELETE).
import { createHash } from 'node:crypto';

const sha = t => createHash('sha1').update(t).digest('hex');
const b64 = t => Buffer.from(t, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');
const json = (status, corps) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });

export function fauxGithub({ jeton = 'jeton-fictif', proprietaire = 'gaetgalc', nom = 'SuiviMacro-data' } = {}) {
  const fichiers = new Map(); // chemin → { texte, sha }
  const appels = [];
  const avantPut = [];
  const gros = new Set();
  const prefixe = `https://api.github.com/repos/${proprietaire}/${nom}`;
  async function fetch(url, opts = {}) {
    const methode = opts.method || 'GET';
    appels.push({ methode, url: String(url), entetes: opts.headers || {} });
    if ((opts.headers?.Authorization || '') !== `Bearer ${jeton}`) return json(401, { message: 'Bad credentials' });
    const u = new URL(url);
    if (!String(url).startsWith(prefixe)) return json(404, { message: 'Not Found' });
    const reste = decodeURIComponent(u.pathname.slice(new URL(prefixe).pathname.length));
    if (reste === '' && methode === 'GET') return json(200, { full_name: `${proprietaire}/${nom}`, private: true });
    if (reste.startsWith('/git/blobs/')) {
      const s = reste.slice('/git/blobs/'.length);
      const trouve = [...fichiers.values()].find(f => f.sha === s);
      return trouve ? json(200, { sha: s, content: b64(trouve.texte), encoding: 'base64' }) : json(404, { message: 'Not Found' });
    }
    if (reste.startsWith('/git/trees/')) {
      if (!fichiers.size) return json(409, { message: 'Git Repository is empty.' });
      return json(200, { tree: [...fichiers].map(([path, f]) => ({ path, type: 'blob', sha: f.sha })), truncated: false });
    }
    const chemin = reste.replace(/^\/contents\//, '');
    const f = fichiers.get(chemin);
    if (methode === 'GET') {
      if (!f) return json(404, { message: 'Not Found' });
      // Au-delà de 1 Mo, GitHub renvoie un contenu vide (encoding « none »).
      return json(200, gros.has(chemin) ? { path: chemin, sha: f.sha, size: f.texte.length, content: '', encoding: 'none' } : { path: chemin, sha: f.sha, content: b64(f.texte), encoding: 'base64' });
    }
    const corps = JSON.parse(opts.body || '{}');
    if (methode === 'PUT') {
      while (avantPut.length) avantPut.shift()();
      const actuel = fichiers.get(chemin);
      if (actuel && corps.sha !== actuel.sha) return json(409, { message: 'sha mismatch' });
      if (!actuel && corps.sha) return json(422, { message: 'sha for missing file' });
      const texte = Buffer.from(corps.content, 'base64').toString('utf8');
      const s = sha(texte);
      fichiers.set(chemin, { texte, sha: s });
      return json(actuel ? 200 : 201, { content: { path: chemin, sha: s } });
    }
    if (methode === 'DELETE') {
      if (!f) return json(404, { message: 'Not Found' });
      if (corps.sha !== f.sha) return json(409, { message: 'sha mismatch' });
      fichiers.delete(chemin);
      return json(200, {});
    }
    return json(405, {});
  }
  return {
    fetch, fichiers, appels,
    ecrireDepuisAilleurs(chemin, texte) { fichiers.set(chemin, { texte, sha: sha(texte) }); },
    /** Exécute fn juste avant le prochain PUT (simule une écriture concurrente). */
    avantProchainPut(fn) { avantPut.push(fn); },
    lireTexte(chemin) { return fichiers.get(chemin)?.texte; },
    simulerGrosFichier(chemin) { gros.add(chemin); },
  };
}
