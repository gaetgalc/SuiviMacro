// Serveur statique : sert la racine du dépôt sous /SuiviMacro/, comme GitHub Pages.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };

export function demarrerServeur(port = 0) {
  const serveur = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/SuiviMacro/')) { res.writeHead(302, { location: '/SuiviMacro/' }); return res.end(); }
    let chemin = normalize(decodeURIComponent(url.pathname.slice('/SuiviMacro/'.length)));
    if (chemin.startsWith('..') || /(^|\/)(node_modules|\.git|tools\/cache)(\/|$)/.test(chemin)) { res.writeHead(403); return res.end(); }
    let fichier = join(RACINE, chemin);
    try { if ((await stat(fichier)).isDirectory()) fichier = join(fichier, 'index.html'); } catch { /* 404 plus bas */ }
    try {
      const corps = await readFile(fichier);
      res.writeHead(200, { 'content-type': TYPES[extname(fichier)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(corps);
    } catch { res.writeHead(404); res.end('introuvable'); }
  });
  return new Promise(ok => serveur.listen(port, '127.0.0.1', () => ok({ serveur, port: serveur.address().port })));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port } = await demarrerServeur(Number(process.argv[2] || 8080));
  console.log(`http://127.0.0.1:${port}/SuiviMacro/`);
}
