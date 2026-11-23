// Service worker : l'app fonctionne hors connexion (§ 13).
const VERSION = 'suivimacro-v2';
const FICHIERS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'css/tokens.css', 'css/base.css',
  'icons/icone-180.png', 'icons/icone-192.png', 'icons/icone-512.png', 'icons/icone.svg',
  'js/app.js',
  'js/core/coach.js', 'js/core/dates.js', 'js/core/depense.js', 'js/core/format.js', 'js/core/fusion.js', 'js/core/grignotage.js',
  'js/core/inbox.js', 'js/core/nutrition.js', 'js/core/phrase.js', 'js/core/proteines.js', 'js/core/recherche.js',
  'js/core/suggestions.js', 'js/core/tendance.js', 'js/core/texte.js',
  'js/data/aliments.js', 'js/data/codebarre.js', 'js/data/db.js', 'js/data/depot.js', 'js/data/ia.js', 'js/data/off.js', 'js/data/sync.js', 'js/data/vues.js',
  'js/ui/accueil.js', 'js/ui/ajouter.js', 'js/ui/aliment.js', 'js/ui/bienvenue.js', 'js/ui/bilan.js', 'js/ui/composants.js', 'js/ui/journal.js', 'js/ui/journee.js', 'js/ui/phrase.js', 'js/ui/quantite.js', 'js/ui/reglages.js', 'js/ui/scanner.js', 'js/ui/tendances.js',
  'data/ciqual.json', 'data/plats.json', 'data/portions.json',
  'vendor/anthropic.js', 'vendor/zxing.js',
  'vendor/fonts/figtree-400.woff2', 'vendor/fonts/figtree-500.woff2', 'vendor/fonts/instrument-sans-400.woff2', 'vendor/fonts/instrument-sans-500.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const cle of await caches.keys()) if (cle !== VERSION) await caches.delete(cle);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'activer') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cle = req.mode === 'navigate' ? new URL('./', self.registration.scope).href : req;
    const enCache = await cache.match(cle, { ignoreSearch: true });
    const reseau = fetch(req).then(r => {
      if (r.ok && req.mode !== 'navigate') cache.put(req, r.clone());
      return r;
    }).catch(() => null);
    if (enCache) { e.waitUntil(reseau); return enCache; }
    return (await reseau) || new Response('Hors connexion', { status: 503 });
  })());
});
