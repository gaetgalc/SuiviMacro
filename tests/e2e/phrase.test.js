import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, configurer, attendreBase } from './outils.js';

const feuilleHaut = page => page.locator('dialog.feuille[open]').last();
const reponseClaude = (aliments, stop = 'end_turn') => ({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: stop, content: stop === 'refusal' ? [] : [{ type: 'text', text: JSON.stringify({ aliments }) }], usage: { input_tokens: 10, output_tokens: 10 } });

test('phrase sans clé : analyse locale, choix, copie pour Claude, réponse collée', async () => {
  const app = await demarrer();
  const { page } = app;
  try {
    await configurer(page, app.url);
    await page.click('#bouton-ajouter');
    await page.locator('[name="recherche"]').waitFor();
    assert.equal(await page.locator('[data-action="photo"]').count(), 0);
    await page.click('[data-action="phrase"]');
    const f = feuilleHaut(page);
    await f.locator('[name="phrase"]').fill('curry pois chiches riz, grosse portion et un skyr');
    await f.locator('[data-action="analyser"]').click();
    await f.locator('[data-lignes] li').nth(1).waitFor();
    assert.equal(await f.locator('[data-lignes] li').count(), 2);
    assert.match(await f.locator('[data-lignes] li').first().textContent(), /Curry de pois chiches et riz/);
    assert.equal(await page.evaluate(() => window.__suivimacro.base.tous('entrees').then(e => e.length)), 0);
    // Faible confiance surlignée
    await f.locator('[name="phrase"]').fill('zorglub et tofu nature');
    await f.locator('[data-action="analyser"]').click();
    await f.locator('[data-lignes] li.surligne').first().waitFor();
    // Demande copiée pour l'app Claude
    await f.locator('[data-action="copier"]').click();
    const copie = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copie, /zorglub et tofu nature/);
    assert.match(copie, /"aliments"/);
    await f.locator('[name="reponse"]').fill('Voici :\n```json\n{"aliments":[{"nom":"Poké tofu","g":450,"kcal":675,"prot":31,"gluc":90,"lip":20,"fib":11,"origineProt":"soja"}]}\n```');
    await f.locator('[data-action="lireReponse"]').click();
    await f.locator('[data-lignes] li', { hasText: 'Poké tofu' }).waitFor();
    await f.locator('[data-action="validerPhrase"]').click();
    const e = await attendreBase(page, x => x.length === 1);
    assert.equal(e[0].nom, 'Poké tofu');
    assert.equal(Math.round(e[0].kcal), 675);
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});

test('phrase avec clé : envoi direct, refus géré', async () => {
  let refuser = false;
  const app = await demarrer({ anthropic: req => (req.model ? reponseClaude([{ nom: 'Burger végé', g: 250, kcal: 600, prot: 25, gluc: 65, lip: 25, fib: 6, origineProt: 'soja' }], refuser ? 'refusal' : 'end_turn') : { id: 'claude-opus-5-5', type: 'model' }) });
  const { page } = app;
  try {
    await configurer(page, app.url);
    await page.evaluate(() => window.__suivimacro.base.poserSecret('cleApi', 'cle-fictive'));
    await page.click('#bouton-ajouter');
    await page.locator('[name="recherche"]').waitFor();
    assert.equal(await page.locator('[data-action="photo"]').count(), 1);
    await page.click('[data-action="phrase"]');
    const f = feuilleHaut(page);
    await f.locator('[name="phrase"]').fill('burger végé au resto');
    await f.locator('[data-action="claude"]').click();
    await f.locator('[data-lignes] li', { hasText: 'Burger végé' }).waitFor();
    refuser = true;
    await f.locator('[data-action="claude"]').click();
    await f.locator('[data-erreur]', { hasText: /refusé/ }).waitFor();
    await f.locator('[data-action="analyser"]').click();
    await f.locator('[data-lignes] li').first().waitFor();
    await f.locator('[data-action="validerPhrase"]').click();
    const e = await attendreBase(page, x => x.length >= 1);
    assert.ok(e.every(x => x.mode === 'phrase'));
  } finally { await app.fermer(); }
});
