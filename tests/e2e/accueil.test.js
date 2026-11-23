import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, configurer, attendreBase } from './outils.js';
import { ajouterJours } from '../../js/core/dates.js';
import { seriePoids } from '../unit/series.js';

const jour = '2026-11-23';
const skyr = { id: 'perso:skyr', source: 'perso', nom: 'Skyr nature', p100: { kcal: 60, prot: 10, gluc: 4, lip: 0.2, fib: 0 }, portions: [], origineProt: 'laitiers', derniere: { qte: 250, unite: 'g' }, utilisations: 20 };
const whey = { id: 'perso:whey', source: 'perso', nom: 'Whey', p100: { kcal: 380, prot: 78, gluc: 6, lip: 5, fib: 0 }, portions: [], origineProt: 'laitiers', derniere: { qte: 30, unite: 'g' }, utilisations: 20 };
function donnees() {
  const entrees = [];
  for (let i = 1; i < 28; i++) {
    const j = ajouterJours(jour, -i);
    entrees.push({ id: `a${i}`, jour: j, repas: 'collation', heure: '16:00', nom: 'Skyr nature', alimentId: skyr.id, qte: 250, unite: 'g', g: 250, kcal: 150, prot: 25, gluc: 10, lip: 0.5, fib: 0, origineProt: 'laitiers' });
    entrees.push({ id: `b${i}`, jour: j, repas: 'dejeuner', heure: '12:30', nom: 'Whey', alimentId: whey.id, qte: 30, unite: 'g', g: 30, kcal: 114, prot: 23.4, gluc: 1.8, lip: 1.5, fib: 0, origineProt: 'laitiers' });
    entrees.push({ id: `c${i}`, jour: j, repas: 'diner', heure: '20:00', nom: 'Dîner', alimentId: null, qte: 1, unite: 'rapide', g: 0, kcal: 1900, prot: 90, gluc: 220, lip: 70, fib: 25, origineProt: 'legumineuses' });
  }
  entrees.push({ id: 'h1', jour: ajouterJours(jour, -1), repas: 'petitdej', heure: '08:00', nom: 'Porridge', alimentId: null, qte: 1, unite: 'rapide', g: 0, kcal: 400, prot: 15, gluc: 60, lip: 8, fib: 6, origineProt: 'cereales' });
  entrees.push({ id: 'auj', jour, repas: 'petitdej', heure: '08:00', nom: 'Tartines', alimentId: null, qte: 1, unite: 'rapide', g: 0, kcal: 600, prot: 20, gluc: 80, lip: 20, fib: 6, origineProt: 'cereales' });
  return {
    aliments: [skyr, whey], entrees,
    mesures: seriePoids({ debut: ajouterJours(jour, -27), jours: 28, depart: 82, kgParSemaine: -0.4, bruit: 0.2, graine: 3 }),
    seances: [{ id: 's1', jour, type: 'Football', debut: `${jour}T12:00`, dureeMin: 90, kcalActives: 720, source: 'raccourci' }],
  };
}

test('accueil : tendance, restant, explication, suggestion, séance', async () => {
  const app = await demarrer({ maintenant: `${jour}T13:00:00` });
  const { page } = app;
  try {
    await configurer(page, app.url, donnees());
    const ordre = await page.$$eval('[data-ecran="accueil"] [data-bloc]', els => els.map(e => e.dataset.bloc));
    assert.deepEqual(ordre.filter(b => ['tendance', 'restant', 'journal'].includes(b)), ['tendance', 'restant', 'journal']);
    assert.match(await page.textContent('[data-bloc="restant"]'), /1\s?500/);
    await page.click('[data-action="expliquerDepense"]');
    assert.match(await page.locator('dialog.feuille[open]').textContent(), /dépense mesurée/i);
    await page.locator('dialog.feuille[open] [data-fermer]').click();
    assert.match(await page.textContent('[data-bloc="seances"]'), /Football/);
    assert.match(await page.textContent('[data-bloc="seances"]'), /pour info/);
    const sugg = page.locator('[data-bloc="suggestion"] [data-action="suggestion"]').first();
    await sugg.click();
    await attendreBase(page, e => e.filter(x => x.jour === jour).length >= 2);
    assert.match(await page.textContent('[data-bloc="bilan"]'), /bilan/i);
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});

test('journal : navigation, modification, suppression, copie, repas enregistré, journée, mesures, séance', async () => {
  const app = await demarrer({ maintenant: `${jour}T13:00:00` });
  const { page } = app;
  try {
    const d = donnees();
    d.entrees.push({ id: 'peu', jour: ajouterJours(jour, -30), repas: 'dejeuner', heure: '12:00', nom: 'Salade', alimentId: null, qte: 1, unite: 'rapide', g: 0, kcal: 300, prot: 5, gluc: 10, lip: 20, fib: 3, origineProt: 'autres' });
    await configurer(page, app.url, d);
    await page.goto(`${app.url}#/journal/${jour}`);
    await page.waitForSelector('[data-ecran="journal"]');
    await page.click('[data-action="jourPrecedent"]');
    await page.waitForFunction(() => location.hash.endsWith('2026-11-22'));
    // Modifier une entrée
    await page.locator('[data-repas="dejeuner"] [data-action="entree"]').first().click();
    await page.locator('dialog.feuille[open] [name="qte"]').fill('60');
    await page.click('dialog.feuille[open] [data-action="valider"]');
    await attendreBase(page, e => Math.round(e.find(x => x.id === 'b1')?.kcal) === 228);
    // Copier le petit-déj vers aujourd'hui
    await page.click('[data-repas="petitdej"] [data-action="copierAujourdhui"]');
    await attendreBase(page, e => e.filter(x => x.jour === jour && x.nom === 'Porridge').length === 1);
    // Enregistrer le dîner comme repas
    page.once('dialog', dlg => dlg.accept('Midi whey'));
    await page.click('[data-repas="dejeuner"] [data-action="enregistrerRepas"]');
    await attendreBase(page, r => r.some(x => x.nom === 'Midi whey'), { magasin: 'repasTypes' });
    // Le repas enregistré s'ajoute en un geste depuis la feuille Ajouter
    await page.click('#bouton-ajouter');
    await page.locator('dialog.feuille[open] [data-action="repasType"]', { hasText: 'Midi whey' }).click();
    await attendreBase(page, e => e.some(x => x.jour === jour && x.mode === 'repas'));
    await page.locator('dialog.feuille[open] [data-fermer]').last().click();
    // Supprimer puis annuler
    await page.locator('[data-repas="dejeuner"] [data-action="supprimer"]').first().click();
    await attendreBase(page, e => !e.some(x => x.id === 'b1'));
    await page.locator('.bandeau', { hasText: 'Whey supprimé' }).locator('button').click();
    await attendreBase(page, e => e.some(x => x.id === 'b1'));
    // Journée peu remplie : question posée
    await page.goto(`${app.url}#/journal/${ajouterJours(jour, -30)}`);
    await page.waitForSelector('[data-bloc="journee"]');
    await page.click('[data-action="journeeIncomplete"]');
    await attendreBase(page, j => j.some(x => x.id === ajouterJours(jour, -30) && x.statut === 'incomplet'), { magasin: 'jours' });
    // Mesures manuelles et séance
    await page.goto(`${app.url}#/journal/${jour}`);
    await page.waitForFunction(() => !document.querySelector('[data-bloc="journee"]') && document.querySelector('[data-ecran="journal"] [name="poids"]'));
    await page.fill('[name="poids"]', '80,4');
    await page.fill('[name="tourTaille"]', '92');
    await page.click('[data-action="enregistrerMesure"]');
    const m = await attendreBase(page, x => x.some(y => y.id === jour && y.tourTaille === 92), { magasin: 'mesures' });
    assert.equal(m.find(y => y.id === jour).poids, 80.4);
    assert.equal(m.find(y => y.id === jour).sources.poids, 'manuel');
    await page.click('[data-action="ajouterSeance"]');
    await page.fill('dialog.feuille[open] [name="type"]', 'Gravel');
    await page.fill('dialog.feuille[open] [name="duree"]', '120');
    await page.click('dialog.feuille[open] [data-action="enregistrerSeance"]');
    await attendreBase(page, s => s.some(x => x.type === 'Gravel'), { magasin: 'seances' });
    assert.deepEqual(app.erreurs, []);
  } finally { await app.fermer(); }
});

test('pesée à confirmer', async () => {
  const app = await demarrer({ maintenant: `${jour}T13:00:00` });
  const { page } = app;
  try {
    const d = donnees();
    d.mesures = d.mesures.map(m => (m.id === jour ? { ...m, poids: 86 } : m));
    await configurer(page, app.url, d);
    await page.locator('[data-action="confirmerPesee"]').click();
    const m = await attendreBase(page, x => x.find(y => y.id === jour)?.poidsConfirme === true, { magasin: 'mesures' });
    assert.ok(m);
  } finally { await app.fermer(); }
});
