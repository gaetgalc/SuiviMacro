import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, configurer } from './outils.js';
import { ajouterJours } from '../../js/core/dates.js';
import { seriePoids } from '../unit/series.js';

const jour = '2026-11-23'; // lundi
function donnees(jours = 28) {
  const entrees = [];
  for (let i = 1; i < jours; i++) {
    const j = ajouterJours(jour, -i);
    entrees.push({ id: `d${i}`, jour: j, repas: 'diner', heure: '20:00', nom: 'Dîner', alimentId: null, qte: 1, unite: 'rapide', g: 0, kcal: 2200, prot: 130, gluc: 230, lip: 70, fib: 28, origineProt: 'legumineuses' });
    if (i % 3 === 0) entrees.push({ id: `g${i}`, jour: j, repas: 'collation', heure: '16:30', nom: 'Biscuits', alimentId: null, qte: 1, unite: 'rapide', g: 0, kcal: 200, prot: 3, gluc: 25, lip: 9, fib: 1, origineProt: 'cereales', grignotage: { raison: 'faim' } });
  }
  return { entrees, mesures: seriePoids({ debut: ajouterJours(jour, -(jours - 1)), jours, depart: 82, kgParSemaine: -0.4, bruit: 0.2, graine: 5 }) };
}
const cibles = page => page.evaluate(() => window.__suivimacro.reglages().then(r => r.cibles));

test('bilan : explication complète, garder les actuelles', async () => {
  const app = await demarrer({ maintenant: `${jour}T09:00:00` });
  const { page } = app;
  try {
    await configurer(page, app.url, donnees());
    const avant = await cibles(page);
    await page.click('[data-bloc="bilan"]');
    await page.waitForSelector('[data-ecran="bilan"]');
    const texte = await page.textContent('[data-ecran="bilan"]');
    for (const m of [/apports moyens/i, /tendance/i, /dépense mesurée/i, /½ ancienne/, /déficit/i, /Protéines fixes/]) assert.match(texte, m);
    assert.equal(await page.locator('[data-ecran="bilan"] table tbody tr').count(), 5);
    await page.click('[data-action="garder"]');
    await page.waitForSelector('[data-ecran="accueil"]');
    assert.deepEqual(await cibles(page), avant);
    assert.equal(await page.locator('[data-bloc="bilan"]').count(), 0);
    const b = await page.evaluate(() => window.__suivimacro.base.lire('bilans', '2026-W47'));
    assert.equal(b.decision, 'refusee');
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});

test('bilan : accepter, puis modifier', async () => {
  const app = await demarrer({ maintenant: `${jour}T09:00:00` });
  const { page } = app;
  try {
    await configurer(page, app.url, donnees());
    await page.goto(`${app.url}#/bilan/2026-W47`);
    const proposees = Number(await page.getAttribute('[data-proposee="kcal"]', 'data-valeur'));
    await page.click('[data-action="accepter"]');
    await page.waitForSelector('[data-ecran="accueil"]');
    const c = await cibles(page);
    assert.equal(c.kcal, proposees);
    assert.equal(c.depuis, jour);
    assert.match(await page.textContent('[data-bloc="restant"]'), new RegExp(String(proposees).replace(/(\d)(\d{3})$/, '$1\\s?$2')));
    const r = await page.evaluate(() => window.__suivimacro.reglages());
    assert.equal(r.historiqueCibles.at(-1).type, 'bilan');
  } finally { await app.fermer(); }
  const app2 = await demarrer({ maintenant: `${jour}T09:00:00` });
  try {
    await configurer(app2.page, app2.url, donnees());
    await app2.page.goto(`${app2.url}#/bilan/2026-W47`);
    await app2.page.click('[data-action="modifier"]');
    await app2.page.fill('[name="prot"]', '160');
    await app2.page.fill('[name="kcal"]', '2150');
    await app2.page.click('[data-action="enregistrerModif"]');
    await app2.page.waitForSelector('[data-ecran="accueil"]');
    const c = await cibles(app2.page);
    assert.equal(c.prot, 160);
    assert.equal(c.kcal, 2150);
    assert.equal((await app2.page.evaluate(() => window.__suivimacro.base.lire('bilans', '2026-W47'))).decision, 'modifiee');
  } finally { await app2.fermer(); }
});

test('bilan trop tôt : ce qui manque', async () => {
  const app = await demarrer({ maintenant: `${jour}T09:00:00` });
  try {
    await configurer(app.page, app.url, donnees(8));
    await app.page.goto(`${app.url}#/bilan/2026-W47`);
    await app.page.waitForSelector('[data-ecran="bilan"]');
    assert.match(await app.page.textContent('[data-ecran="bilan"]'), /14 jours/);
    assert.equal(await app.page.locator('[data-action="accepter"]').count(), 0);
  } finally { await app.fermer(); }
});

test('tendances : tous les blocs, sans erreur', async () => {
  const app = await demarrer({ maintenant: `${jour}T09:00:00` });
  const { page } = app;
  try {
    await configurer(page, app.url, donnees());
    await page.goto(`${app.url}#/tendances`);
    await page.waitForSelector('[data-ecran="tendances"]');
    for (const b of ['poids', 'depense', 'apports', 'proteines', 'grignotage', 'bilans']) assert.equal(await page.locator(`[data-bloc="${b}"]`).count(), 1, b);
    assert.ok(await page.locator('[data-bloc="poids"] svg.graphique').count() >= 1);
    assert.match(await page.textContent('[data-bloc="grignotage"]'), /16 h et 18 h/);
    for (const p of ['90', '365']) {
      await page.click(`[data-action="periode"][data-valeur="${p}"]`);
      await page.waitForFunction(v => location.hash.endsWith(v), p);
      await page.waitForSelector(`[data-action="periode"][data-valeur="${p}"][aria-pressed="true"]`);
    }
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});
