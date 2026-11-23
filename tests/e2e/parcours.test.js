import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, attendreBase } from './outils.js';

const feuilleHaut = page => page.locator('dialog.feuille[open]').last();

async function premiereOuverture(page, url) {
  await page.goto(url);
  await page.waitForSelector('[data-ecran="bienvenue"]');
  await page.click('text=Plus tard');
  await page.fill('[name="naissance"]', '1990-01-01');
  await page.fill('[name="taille"]', '180');
  await page.fill('[name="poids"]', '85');
  await page.click('text=Continuer');
  await page.fill('[name="prot"]', '120');
  await page.click('text=Commencer');
  await page.waitForSelector('[data-ecran="accueil"]');
}

test('parcours complet : sans jeton, saisies, deux appareils, raccourci', async () => {
  const app = await demarrer({ maintenant: '2026-11-23T12:41:00' });
  const { page, gh } = app;
  try {
    await premiereOuverture(page, app.url);
    assert.equal(await page.textContent('#pastille-sync'), 'Non synchronisé');
    // Recherche et ajout
    await page.click('#bouton-ajouter');
    await page.fill('[name="recherche"]', 'lentille corail bouillie');
    await page.locator('[data-resultats] [data-action="choisir"]').first().click();
    await feuilleHaut(page).locator('[name="qte"]').fill('200');
    await feuilleHaut(page).locator('[name="unite"]').selectOption('g');
    await feuilleHaut(page).locator('[name="qte"]').fill('200');
    await feuilleHaut(page).locator('[data-action="valider"]').click();
    await attendreBase(page, e => e.length === 1);
    // Ajout direct d'un habituel
    await page.fill('[name="recherche"]', '');
    await page.locator('[data-habituels] [data-action="direct"]').first().click();
    await attendreBase(page, e => e.length === 2);
    // Phrase
    await page.click('[data-action="phrase"]');
    await feuilleHaut(page).locator('[name="phrase"]').fill('un skyr et deux falafels');
    await feuilleHaut(page).locator('[data-action="analyser"]').click();
    await feuilleHaut(page).locator('[data-lignes] li').nth(1).waitFor();
    await feuilleHaut(page).locator('[data-action="validerPhrase"]').click();
    await attendreBase(page, e => e.length === 4);
    await feuilleHaut(page).locator('[data-fermer]').click();
    // Repas enregistré depuis le journal
    await page.goto(`${app.url}#/journal/2026-11-23`);
    page.once('dialog', d => d.accept('Midi lentilles'));
    await page.click('[data-repas="dejeuner"] [data-action="enregistrerRepas"]');
    await attendreBase(page, r => r.length === 1, { magasin: 'repasTypes' });
    // Connexion du dépôt depuis les réglages : tout part
    await page.goto(`${app.url}#/reglages`);
    await page.fill('[name="jeton"]', 'jeton-fictif');
    await page.click('[data-action="jeton"]');
    await page.waitForFunction(() => /Connecté au dépôt privé/.test(document.querySelector('#synchronisation')?.textContent || ''));
    await page.waitForFunction(() => window.__suivimacro.sync && !window.__suivimacro.sync.etat().enCours && window.__suivimacro.sync.etat().enAttente === 0);
    assert.match(gh.lireTexte('journal/2026-11.json'), /Falafel/);
    assert.match(gh.lireTexte('repas-types.json'), /Midi lentilles/);
    // Deuxième appareil : récupère tout sans repasser par le profil
    const p2 = await app.autreAppareil();
    await p2.goto(app.url);
    await p2.waitForSelector('[data-ecran="bienvenue"]');
    await p2.fill('[name="jeton"]', 'jeton-fictif');
    await p2.click('text=Connecter');
    await p2.waitForSelector('[data-ecran="accueil"]');
    await attendreBase(p2, e => e.length === 4);
    // Ajouts croisés le même mois, puis synchronisations
    await page.evaluate(() => window.__suivimacro.base.ecrire('entrees', { id: 'x-a', jour: '2026-11-23', repas: 'diner', heure: '20:00', nom: 'Soupe A', kcal: 200, prot: 8, gluc: 20, lip: 8, fib: 4, qte: 1, unite: 'rapide' }));
    await p2.evaluate(() => window.__suivimacro.base.ecrire('entrees', { id: 'x-b', jour: '2026-11-23', repas: 'diner', heure: '20:05', nom: 'Pain B', kcal: 150, prot: 5, gluc: 30, lip: 1, fib: 3, qte: 1, unite: 'rapide' }));
    for (const p of [page, p2, page]) await p.evaluate(() => window.__suivimacro.sync.synchroniser());
    for (const p of [page, p2]) await attendreBase(p, e => e.some(x => x.id === 'x-a') && e.some(x => x.id === 'x-b') && e.length === 6);
    // Envoi du raccourci (pesée de la veille, % de gras du jour ; la pesée manuelle du jour reste)
    gh.ecrireDepuisAilleurs('inbox/2026-11-23T07-05-00.json', JSON.stringify({ version: 1, poids: [{ date: '2026-11-22T06:58:00+01:00', kg: '84,6' }, { date: '2026-11-23T06:58:00+01:00', kg: '84,2' }], gras: [{ date: '2026-11-23T06:58:00+01:00', pct: '18,4' }] }));
    await page.evaluate(() => window.__suivimacro.sync.synchroniser());
    await page.goto(`${app.url}#/accueil`);
    await page.waitForFunction(() => /84,6/.test(document.querySelector('[data-bloc="tendance"]')?.textContent || ''));
    assert.equal(gh.fichiers.has('inbox/2026-11-23T07-05-00.json'), false);
    const m = await page.evaluate(() => window.__suivimacro.base.lire('mesures', '2026-11-23'));
    assert.equal(m.poids, 85);
    assert.equal(m.grasPct, 18.4);
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});
