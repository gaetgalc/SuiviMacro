import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, configurer } from './outils.js';
import { metabolismeBase } from '../../js/core/depense.js';

test('première ouverture : installation, profil, cibles proposées', async () => {
  const app = await demarrer({ installe: false });
  const { page } = app;
  try {
    await page.goto(app.url);
    await page.waitForSelector('[data-ecran="bienvenue"]');
    assert.match(await page.textContent('#ecran'), /Sur l'écran d'accueil/);
    await page.click('text=Continuer');
    await page.click('text=Plus tard');
    await page.click('[data-valeur="h"]');
    await page.fill('[name="naissance"]', '1990-01-01');
    await page.fill('[name="taille"]', '180');
    await page.fill('[name="poids"]', '85');
    await page.selectOption('[name="activite"]', 'modere');
    await page.click('text=Continuer');
    const kcal = Number(await page.inputValue('[name="kcal"]'));
    const mb = metabolismeBase({ sexe: 'h', poidsKg: 85, tailleCm: 180, age: 36 });
    assert.equal(kcal, Math.round((Math.round(mb * 1.55) - Math.round(0.005 * 85 * 1100)) / 10) * 10);
    await page.fill('[name="prot"]', '120');
    await page.click('text=Commencer');
    await page.waitForSelector('[data-ecran="accueil"]');
    const r = await page.evaluate(() => window.__suivimacro.reglages());
    assert.equal(r.cibles.prot, 120);
    assert.equal((await page.evaluate(() => window.__suivimacro.base.lire('mesures', '2026-11-23'))).poids, 85);
    assert.equal(await page.textContent('#pastille-sync'), 'Non synchronisé');
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});

test('dépôt déjà rempli : profil et cibles sautés', async () => {
  const app = await demarrer();
  const { page, gh } = app;
  gh.ecrireDepuisAilleurs('reglages.json', JSON.stringify({ version: 1, reglages: [{ id: 'reglages', profil: { sexe: 'h', naissance: '1990-01-01', tailleCm: 180, activite: 'modere' }, cibles: { kcal: 2050, prot: 120, gluc: 220, lip: 65, fib: 30, depuis: '2026-11-01' }, partGlucides: 0.6, rythmePct: 0.5, depenseRetenue: 2700, jourBilan: 1, majLe: '2026-11-01T00:00:00.000Z' }] }));
  try {
    await page.goto(app.url);
    await page.waitForSelector('[data-ecran="bienvenue"]');
    await page.fill('[name="jeton"]', 'jeton-fictif');
    await page.click('text=Connecter');
    await page.waitForSelector('[data-ecran="accueil"]');
    assert.equal((await page.evaluate(() => window.__suivimacro.reglages())).cibles.kcal, 2050);
  } finally { await app.fermer(); }
});

test('réglages : jeton, expiration, export, import, à propos', async () => {
  const app = await demarrer();
  const { page } = app;
  try {
    await configurer(page, app.url, { aliments: [{ id: 'perso:1', source: 'perso', nom: 'Galette maison', p100: { kcal: 200, prot: 8, gluc: 30, lip: 5, fib: 3 }, portions: [] }] });
    await page.goto(`${app.url}#/reglages`);
    await page.waitForSelector('[data-ecran="reglages"]');
    const texte = await page.textContent('#apropos');
    for (const m of ['Ciqual 2025', 'CC-BY 4.0', 'Open Food Facts', 'ODbL']) assert.match(texte, new RegExp(m));
    await page.fill('[name="jeton"]', 'mauvais');
    await page.click('[data-action="jeton"]');
    await page.waitForSelector('#message-jeton.erreur-texte');
    assert.match(await page.textContent('#message-jeton'), /refusé/);
    await page.fill('[name="jeton"]', 'jeton-fictif');
    await page.fill('[name="jetonExpire"]', '2026-12-03');
    await page.click('[data-action="jeton"]');
    await page.waitForFunction(() => /expire dans 10 jours/.test(document.querySelector('#synchronisation')?.textContent || ''));
    assert.ok(app.gh.lireTexte('aliments.json').includes('Galette maison'));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="exporter"]')]);
    const chemin = await dl.path();
    const { readFileSync } = await import('node:fs');
    const exp = JSON.parse(readFileSync(chemin, 'utf8'));
    assert.equal(exp.magasins.aliments[0].nom, 'Galette maison');
    assert.ok(!JSON.stringify(exp).includes('jeton-fictif'));
    // Import dans un appareil neuf
    const p2 = await app.autreAppareil();
    await configurer(p2, app.url, {});
    await p2.goto(`${app.url}#/reglages`);
    await p2.setInputFiles('[data-importer]', chemin);
    await p2.waitForSelector('#message-donnees.ok-texte');
    assert.equal((await p2.evaluate(() => window.__suivimacro.base.lire('aliments', 'perso:1'))).nom, 'Galette maison');
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});

test('bienvenue inaccessible une fois configuré', async () => {
  const app = await demarrer();
  try {
    await configurer(app.page, app.url);
    await app.page.goto(`${app.url}#/bienvenue`);
    await app.page.waitForSelector('[data-ecran="accueil"]');
    assert.equal(await app.page.evaluate(() => location.hash), '#/accueil');
  } finally { await app.fermer(); }
});
