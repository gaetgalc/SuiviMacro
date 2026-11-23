import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, configurer, attendreBase } from './outils.js';

const entrees = page => page.evaluate(() => window.__suivimacro.base.tous('entrees'));

test('ajout par recherche, ajout direct, annulation, quantité, grignotage', async () => {
  const app = await demarrer({ maintenant: '2026-11-23T12:41:00' });
  const { page } = app;
  try {
    await configurer(page, app.url);
    await page.click('#bouton-ajouter');
    const feuille = page.locator('dialog.feuille[open]');
    await feuille.waitFor();
    assert.equal(await feuille.locator('[name="repas"]').inputValue(), 'dejeuner');
    assert.ok(await page.evaluate(() => document.activeElement?.name === 'recherche'));
    await page.fill('[name="recherche"]', 'tofu');
    await page.locator('[data-resultats] [data-action="choisir"]', { hasText: 'Tofu nature' }).first().click();
    const qte = page.locator('dialog.feuille[open] [name="qte"]');
    await qte.waitFor();
    // Portion usuelle du tofu (100 g) proposée par défaut.
    assert.equal(await qte.inputValue(), '1');
    assert.equal(await page.inputValue('dialog.feuille[open] [name="unite"]'), 'portion');
    const avant = await page.textContent('#restant-apres');
    await qte.fill('2');
    assert.notEqual(await page.textContent('#restant-apres'), avant);
    await qte.fill('1');
    await page.click('dialog.feuille[open] [data-action="valider"]');
    await page.waitForSelector('.bandeau');
    const premiere = (await entrees(page))[0];
    // La feuille Ajouter reste ouverte ; le tofu est un habituel du déjeuner.
    await page.fill('[name="recherche"]', '');
    const habituel = page.locator('[data-habituels] li', { hasText: 'Tofu nature' });
    await habituel.waitFor();
    await habituel.locator('[data-action="direct"]').click();
    await attendreBase(page, e => e.length === 2);
    const seconde = (await entrees(page)).find(x => x.id !== premiere.id);
    assert.equal(seconde.qte, 1);
    assert.equal(seconde.g, 100);
    await page.locator('.bandeau button', { hasText: 'Annuler' }).last().click();
    await attendreBase(page, e => e.length === 1);
    // Portion avec virgule et grignotage
    await page.fill('[name="recherche"]', 'oeuf dur');
    await page.locator('[data-resultats] [data-action="choisir"]', { hasText: 'Oeuf dur' }).first().click();
    await qte.waitFor();
    assert.equal(await page.inputValue('dialog.feuille[open] [name="unite"]'), 'piece');
    await qte.fill('1,5');
    await page.check('dialog.feuille[open] [name="grignotage"]');
    await page.click('dialog.feuille[open] [data-action="raison"][data-valeur="ennui"]');
    await page.click('dialog.feuille[open] [data-action="valider"]');
    await attendreBase(page, e => e.some(x => x.nom === 'Oeuf dur'));
    assert.equal((await entrees(page)).length, 2);
    const oeuf = (await entrees(page)).find(x => x.nom === 'Oeuf dur');
    assert.equal(oeuf.g, 75);
    assert.deepEqual(oeuf.grignotage, { raison: 'ennui' });
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});

test('création d\'aliment, recette, repas enregistré, ajout rapide, produits Open Food Facts', async () => {
  const app = await demarrer({ maintenant: '2026-11-23T19:30:00' });
  const { page } = app;
  try {
    await configurer(page, app.url);
    await page.click('#bouton-ajouter');
    await page.fill('[name="recherche"]', 'zorglub');
    await page.click('[data-action="creer"]');
    await page.fill('dialog.feuille[open] [name="nom"]', 'Zorglub maison');
    for (const [k, v] of [['kcal', '200'], ['prot', '10'], ['gluc', '20'], ['lip', '8'], ['fib', '3']]) await page.fill(`dialog.feuille[open] [name="${k}"]`, v);
    await page.click('dialog.feuille[open] [data-action="enregistrer"]');
    await page.locator('dialog.feuille[open] [name="qte"]').waitFor();
    await page.click('dialog.feuille[open] [data-action="valider"]');
    await attendreBase(page, e => e.length === 1);
    // Recette : 2 ingrédients, 4 parts
    await page.click('[data-action="recette"]');
    await page.fill('dialog.feuille[open] [name="nom"]', 'Dahl du dimanche');
    await page.fill('dialog.feuille[open] [name="nbParts"]', '4');
    await page.fill('dialog.feuille[open] [name="ingredient"]', 'lentille corail bouillie');
    await page.locator('dialog.feuille[open] [data-action="ingredient"]').first().click();
    await page.fill('dialog.feuille[open] [name="g-0"]', '400');
    await page.fill('dialog.feuille[open] [name="ingredient"]', 'zorglub');
    await page.locator('dialog.feuille[open] [data-action="ingredient"]').first().click();
    await page.fill('dialog.feuille[open] [name="g-1"]', '200');
    await page.click('dialog.feuille[open] [data-action="enregistrerRecette"]');
    const qte = page.locator('dialog.feuille[open] [name="qte"]');
    await qte.waitFor();
    assert.equal(await page.inputValue('dialog.feuille[open] [name="unite"]'), 'part');
    await page.click('dialog.feuille[open] [data-action="valider"]');
    await attendreBase(page, e => e.length === 2);
    const dahl = (await entrees(page)).find(e => e.nom === 'Dahl du dimanche');
    assert.equal(Math.round(dahl.g), 150);
    // Ajout rapide
    await page.click('[data-action="rapide"]');
    await page.fill('dialog.feuille[open] [name="nom"]', 'Resto midi');
    await page.fill('dialog.feuille[open] [name="kcal"]', '650');
    await page.click('dialog.feuille[open] [data-action="ajouterRapide"]');
    await attendreBase(page, e => e.some(x => x.nom === 'Resto midi' && x.kcal === 650));
    // Produits Open Food Facts
    await page.fill('[name="recherche"]', 'tofu ferme');
    await page.locator('[data-produits] [data-action="choisir"]', { hasText: 'Tofu ferme fumé' }).waitFor();
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});
