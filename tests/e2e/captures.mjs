// Captures d'écran pour relecture visuelle (hors suite de tests).
import { demarrer, configurer } from './outils.js';
import { ajouterJours } from '../../js/core/dates.js';
import { seriePoids } from '../unit/series.js';

const dossier = process.argv[2];
const jour = '2026-11-23';
const skyr = { id: 'perso:skyr', source: 'perso', nom: 'Skyr nature', p100: { kcal: 62, prot: 11, gluc: 4, lip: 0.2, fib: 0 }, portions: [{ id: 'pot', nom: 'pot', g: 150 }], origineProt: 'laitiers', derniere: { qte: 1, unite: 'pot' }, utilisations: 20 };
const whey = { id: 'perso:whey', source: 'perso', nom: 'Whey', p100: { kcal: 380, prot: 78, gluc: 6, lip: 5, fib: 0 }, portions: [{ id: 'dose', nom: 'dose', g: 30 }], origineProt: 'laitiers', derniere: { qte: 1, unite: 'dose' }, utilisations: 20 };
const curry = { id: 'recette:curry', source: 'recette', nom: 'Curry de pois chiches', p100: { kcal: 130, prot: 5.5, gluc: 15, lip: 5, fib: 4 }, portions: [{ id: 'part', nom: 'part', g: 380 }], origineProt: 'legumineuses', derniere: { qte: 1, unite: 'part' }, utilisations: 9, recette: { ingredients: [], nbPortions: 4 } };
const entrees = [];
for (let i = 0; i < 40; i++) {
  const j = ajouterJours(jour, -i);
  entrees.push({ id: `p${i}`, jour: j, repas: 'petitdej', heure: '08:10', nom: 'Flocons d\'avoine', alimentId: null, qte: 60, unite: 'g', g: 60, kcal: 225, prot: 8, gluc: 36, lip: 4, fib: 6, origineProt: 'cereales' });
  entrees.push({ id: `s${i}`, jour: j, repas: 'petitdej', heure: '08:12', nom: 'Skyr nature', alimentId: skyr.id, qte: 1, unite: 'pot', g: 150, kcal: 93, prot: 16.5, gluc: 6, lip: 0.3, fib: 0, origineProt: 'laitiers' });
  entrees.push({ id: `c${i}`, jour: j, repas: 'dejeuner', heure: '12:40', nom: 'Curry de pois chiches', alimentId: curry.id, qte: 1, unite: 'part', g: 380, kcal: 494, prot: 21, gluc: 57, lip: 19, fib: 15, origineProt: 'legumineuses' });
  if (i > 0) {
    entrees.push({ id: `w${i}`, jour: j, repas: 'collation', heure: '17:00', nom: 'Whey', alimentId: whey.id, qte: 1, unite: 'dose', g: 30, kcal: 114, prot: 23, gluc: 2, lip: 1.5, fib: 0, origineProt: 'laitiers' });
    entrees.push({ id: `d${i}`, jour: j, repas: 'diner', heure: '20:15', nom: 'Tofu sauté, riz', alimentId: null, qte: 1, unite: 'rapide', g: 0, kcal: 720, prot: 38, gluc: 80, lip: 24, fib: 7, origineProt: 'soja' });
    if (i % 4 === 1) entrees.push({ id: `g${i}`, jour: j, repas: 'collation', heure: '16:20', nom: 'Biscuits', alimentId: null, qte: 1, unite: 'rapide', g: 0, kcal: 220, prot: 3, gluc: 28, lip: 10, fib: 1, origineProt: 'cereales', grignotage: { raison: i % 8 === 1 ? 'faim' : 'ennui' } });
  }
}
const app = await demarrer({ maintenant: `${jour}T13:05:00` });
const { page } = app;
await page.emulateMedia({ reducedMotion: 'reduce' });
await configurer(page, app.url, {
  aliments: [skyr, whey, curry], entrees,
  mesures: seriePoids({ debut: ajouterJours(jour, -39), jours: 40, depart: 84, kgParSemaine: -0.5, bruit: 0.35, graine: 9 }),
  seances: [{ id: 's1', jour, type: 'Football', debut: `${jour}T12:00`, dureeMin: 90, kcalActives: 720, source: 'raccourci' }],
});
const shot = async nom => { await page.waitForTimeout(250); await page.screenshot({ path: `${dossier}/${nom}.png`, fullPage: true }); };
await shot('1-accueil');
await page.click('#bouton-ajouter'); await page.locator('[data-habituels]').waitFor(); await shot('2-ajouter');
await page.fill('[name="recherche"]', 'tofu'); await page.waitForTimeout(700); await shot('3-recherche');
await page.locator('[data-resultats] [data-action="choisir"]').first().click(); await page.locator('[name="qte"]').waitFor(); await shot('4-quantite');
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await page.goto(`${app.url}#/journal/${jour}`); await page.waitForSelector('[data-ecran="journal"]'); await shot('5-journal');
await page.goto(`${app.url}#/tendances`); await page.waitForSelector('[data-bloc="bilans"]'); await shot('6-tendances');
await page.goto(`${app.url}#/bilan/2026-W47`); await page.waitForSelector('[data-ecran="bilan"]'); await shot('7-bilan');
await page.goto(`${app.url}#/reglages`); await page.waitForSelector('[data-ecran="reglages"]'); await shot('8-reglages');
console.log(app.erreurs);
await app.fermer();
