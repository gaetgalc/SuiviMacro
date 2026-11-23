import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, configurer } from './outils.js';

test('coquille : chargement, onglets, largeur, aucune erreur', async () => {
  const app = await demarrer();
  try {
    await configurer(app.page, app.url);
    assert.equal(await app.page.locator('nav.onglets a, nav.onglets button').count(), 5);
    const largeur = await app.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    assert.ok(largeur[0] <= largeur[1], `défilement horizontal : ${largeur}`);
    await app.page.setViewportSize({ width: 375, height: 700 });
    const l2 = await app.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    assert.ok(l2[0] <= l2[1], `375 px : ${l2}`);
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});

test('hors connexion après un premier chargement (service worker)', async () => {
  const app = await demarrer({ sw: true });
  try {
    await configurer(app.page, app.url);
    await app.page.evaluate(() => navigator.serviceWorker.ready);
    await app.page.reload();
    await app.page.waitForFunction(() => navigator.serviceWorker.controller);
    await app.contexte.setOffline(true);
    await app.page.reload();
    await app.page.waitForSelector('[data-ecran="accueil"]', { timeout: 10000 });
    await app.contexte.setOffline(false);
  } finally { await app.fermer(); }
});
