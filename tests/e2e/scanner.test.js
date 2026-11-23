import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, configurer, attendreBase } from './outils.js';
import { modulesEan13 } from '../unit/ean13.js';

async function pngEan13(page, code) {
  const url = await page.evaluate(m => {
    const c = document.createElement('canvas');
    c.width = m.length * 3 + 60; c.height = 140;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000';
    [...m].forEach((b, i) => { if (b === '1') g.fillRect(30 + i * 3, 10, 3, 120); });
    return c.toDataURL('image/png');
  }, modulesEan13(code));
  return Buffer.from(url.split(',')[1], 'base64');
}

test('code-barres : repli sans caméra, saisie, produit inconnu, photo', async () => {
  const app = await demarrer();
  const { page } = app;
  try {
    await configurer(page, app.url);
    await page.click('#bouton-ajouter');
    await page.click('[data-action="code"]');
    await page.locator('dialog.feuille[open] [name="code"]').waitFor();
    assert.ok(await page.locator('dialog.feuille[open] [data-photo-code]').isVisible());
    // Produit connu d'Open Food Facts
    await page.fill('dialog.feuille[open] [name="code"]', '3017620422003');
    await page.click('dialog.feuille[open] [data-action="chercherCode"]');
    await page.locator('dialog.feuille[open] [name="qte"]').waitFor();
    assert.match(await page.locator('dialog.feuille[open] .feuille-tete h2').last().textContent(), /Tofu ferme fumé/);
    await page.click('dialog.feuille[open] [data-action="valider"]');
    await attendreBase(page, e => e.length === 1 && e[0].nom === 'Tofu ferme fumé');
    // Code inconnu → création, retrouvé au scan suivant
    await page.click('[data-action="code"]');
    await page.fill('dialog.feuille[open] [name="code"]', '1234567890128');
    await page.click('dialog.feuille[open] [data-action="chercherCode"]');
    await page.locator('dialog.feuille[open] [name="kcal"]').waitFor();
    await page.fill('dialog.feuille[open] [name="nom"]', 'Barre maison');
    await page.fill('dialog.feuille[open] [name="kcal"]', '400');
    await page.click('dialog.feuille[open] [data-action="enregistrer"]');
    await page.locator('dialog.feuille[open] [name="qte"]').waitFor();
    await page.click('dialog.feuille[open] [data-action="valider"]');
    await attendreBase(page, e => e.some(x => x.nom === 'Barre maison'));
    await page.click('[data-action="code"]');
    await page.fill('dialog.feuille[open] [name="code"]', '1234567890128');
    await page.click('dialog.feuille[open] [data-action="chercherCode"]');
    await page.locator('dialog.feuille[open] [name="qte"]').waitFor();
    assert.match(await page.locator('dialog.feuille[open] .feuille-tete h2').last().textContent(), /Barre maison/);
    await page.locator('dialog.feuille[open] [data-fermer]').last().click();
    // Photo d'un code-barres
    await page.click('[data-action="code"]');
    await page.setInputFiles('dialog.feuille[open] [data-photo-code] input', { name: 'code.png', mimeType: 'image/png', buffer: await pngEan13(page, '3017620422003') });
    await page.locator('dialog.feuille[open] [name="qte"]').waitFor();
    assert.match(await page.locator('dialog.feuille[open] .feuille-tete h2').last().textContent(), /Tofu ferme fumé/);
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});
