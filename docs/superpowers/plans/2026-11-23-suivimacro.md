# SuiviMacro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** construire SuiviMacro, site statique de suivi nutritionnel installable sur iPhone (dépense adaptative, bilan hebdomadaire, saisie rapide, synchronisation par dépôt GitHub privé), conforme au cahier des charges.

**Architecture :** modules ES servis tels quels par GitHub Pages. Logique pure dans `js/core/` (testée sous Node), accès aux données et au réseau dans `js/data/` (dépendances injectées, testées avec des faux), écrans dans `js/ui/`. IndexedDB fait foi sur l'appareil ; synchronisation par fichiers JSON dans `gaetgalc/SuiviMacro-data`.

**Tech Stack :** HTML, CSS, JavaScript (modules ES, sans framework ni compilation du site) ; IndexedDB ; service worker ; `node --test` ; `fake-indexeddb` ; Playwright préinstallé (bibliothèque `playwright`, Chromium) ; `esbuild` uniquement pour `tools/vendor.mjs` ; `@zxing/library` ; `@anthropic-ai/sdk`.

**Spec :** `docs/superpowers/specs/2026-11-23-suivimacro-design.md` (les § cités ci-dessous y renvoient). Lire aussi `CLAUDE.md` et `docs/INTERVIEW.md`.

## Global Constraints

- Tous les textes de l'interface en français ; thème sombre uniquement ; cibles tactiles ≥ 44 px ; utilisable à 375 px de large.
- Chemins **relatifs** partout (site servi sous `/SuiviMacro/`) ; `start_url` et `scope` = `./`.
- Aucune clé, aucun jeton, aucun e-mail, aucune donnée personnelle dans le dépôt, tests compris (données fictives).
- Aucun appel réseau hors `api.github.com`, `world.openfoodfacts.org`, `search.openfoodfacts.org`, `api.anthropic.com`.
- `js/core/` : fonctions pures, sans DOM, sans `Date.now()` implicite (la date du jour est un paramètre).
- Enregistrements synchronisés : `id`, `majLe` (ISO), `supprime: true` pour supprimer (jamais d'effacement).
- Jour logique : coupure à 4 h, heure locale. Dates de jour au format `AAAA-MM-JJ`, semaines `AAAA-Wss` (ISO).
- Arrondis seulement à l'affichage : kcal à l'unité, macros à l'unité à l'écran, 0,1 g dans les calculs.
- Constantes : 7 700 kcal/kg ; tendance α = 0,1 ; pente sur 14 jours ; fenêtre dépense 21 jours, ≥ 14 jours valides, ≥ 8 pesées, mise à jour 0,5/0,5 ; journée valide ≥ 1 000 kcal ou `complet` ; rythme 0,5 %/semaine ; fibres 30 g ; plancher lipides 0,6 g/kg ; bilan le lundi.
- Commandes : `npm test` (unitaires), `npm run e2e` (bout en bout). Messages de commit en français.

## Review Focus

- Accents dans les fichiers synchronisés (« Pâtes complètes », « crème ») : l'aller-retour base64 doit restituer exactement le texte → test dans la tâche 15.
- Passage à l'heure d'hiver/été (25-26 octobre, 29-30 mars) : un écart de jours ne doit ni sauter ni doubler un jour → test dans la tâche 1, utilisé par la tendance.
- Quantité tapée avec une virgule (« 1,5 », « 0,5 bol ») ou vide : lue comme nombre français, vide refusé sans planter → test dans la tâche 2.
- Produit Open Food Facts incomplet (pas de kcal mais des kJ, macros manquantes, pas de nom français) : aliment utilisable ou demande de saisie, jamais `NaN` affiché → test dans la tâche 16.
- App installée sans jeton ni clé (premier jour, ou Gaëtan saute l'étape) : tout fonctionne en local, la pastille dit « non synchronisé », aucune erreur → test dans la tâche 24.

---

### Task 1 : socle du projet et dates

**Files :**
- Create : `package.json`, `.gitignore`, `js/core/dates.js`, `tests/unit/dates.test.js`

**Interfaces :**
- Produces :
  - `jourLogique(date: Date): string` (coupure 4 h, local)
  - `ajouterJours(jour: string, n: number): string`
  - `ecartJours(de: string, a: string): number` (entier, insensible aux changements d'heure)
  - `joursEntre(de: string, a: string): string[]` (bornes incluses)
  - `semaineIso(jour: string): string` → `'2026-W48'`
  - `lundiDe(jour: string): string`
  - `repasSelonHeure(date: Date): 'petitdej'|'dejeuner'|'collation'|'diner'`
  - `age(naissance: string, jour: string): number`

- [ ] **Step 1 :** `package.json` : `"type": "module"`, scripts `test` = `node --test tests/unit/`, `e2e` = `node --test tests/e2e/`, `vendor` = `node tools/vendor.mjs`, `ciqual` = `node tools/ciqual.mjs` ; `devDependencies` : `fake-indexeddb`, `esbuild`, `@zxing/library`, `@anthropic-ai/sdk` (dernières versions npm). `.gitignore` : `node_modules/`, `tools/cache/`. `npm install`.
- [ ] **Step 2 : tests rouges** `tests/unit/dates.test.js` :
  - `jourLogique(new Date(2026,10,24,3,59))` → `'2026-11-23'` ; à `4:00` → `'2026-11-24'`
  - `ecartJours('2026-10-24','2026-10-27')` → `3` ; `ecartJours('2027-03-27','2027-03-29')` → `2`
  - `joursEntre('2026-10-24','2026-10-26').length` → `3`
  - `semaineIso('2026-11-23')` → `'2026-W48'` ; `semaineIso('2027-01-01')` → `'2026-W53'`
  - `lundiDe('2026-11-29')` → `'2026-11-23'`
  - `repasSelonHeure` : 10:29 → `petitdej`, 10:30 → `dejeuner`, 14:30 → `collation`, 18:30 → `diner`, 2:00 → `diner`
  - `age('1997-06-15','2026-11-23')` → `29`
- [ ] **Step 3 :** `npm test` → FAIL (module absent).
- [ ] **Step 4 :** implémenter `js/core/dates.js` (calculs de jours en UTC à partir de `AAAA-MM-JJ`, jamais en millisecondes locales).
- [ ] **Step 5 :** `npm test` → PASS.
- [ ] **Step 6 :** commit `Socle : package, dates`.

### Task 2 : nutrition

**Files :** Create `js/core/nutrition.js`, `tests/unit/nutrition.test.js`

**Interfaces :**
- Consumes : forme `Aliment` (§ 6.1 : `p100: {kcal,prot,gluc,lip,fib}`, `portions: [{id,nom,g}]`).
- Produces :
  - `lireQuantite(texte: string): number|null` (virgule ou point, « 1/2 », vide → `null`)
  - `grammes(aliment, qte: number, unite: string): number` (`'g'` et `'ml'` = grammes ; sinon id de portion)
  - `valeurs(aliment, qte, unite): {g,kcal,prot,gluc,lip,fib}` (`fib` reste `null` si inconnu)
  - `somme(entrees: Entree[]): {kcal,prot,gluc,lip,fib}` (ignore `supprime`)
  - `restant(cibles, totaux): {kcal,prot,gluc,lip,fib}` (peut être négatif)
  - `p100Recette(ingredients: {aliment, g}[], poidsCuitG?: number): p100`
  - `kcalDepuisMacros(prot, gluc, lip): number` (4/4/9)

- [ ] **Step 1 : tests rouges** :
  - `lireQuantite('1,5')` → `1.5` ; `'0.5'` → `0.5` ; `'1/2'` → `0.5` ; `''` → `null` ; `'abc'` → `null`
  - tofu fictif `p100 {kcal:120, prot:12, gluc:2, lip:7, fib:1}` : `valeurs(tofu,150,'g')` → `{g:150,kcal:180,prot:18,gluc:3,lip:10.5,fib:1.5}`
  - portion `{id:'pot', g:125}` : `grammes(skyr, 2, 'pot')` → `250`
  - `somme` ignore une entrée `supprime: true`
  - `p100Recette([{aliment:A, g:200},{aliment:B, g:100}], 600)` → valeurs totales / 6
- [ ] **Step 2 :** `npm test` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `npm test` → PASS.
- [ ] **Step 5 :** commit `Calcul nutritionnel`.

### Task 3 : fusion des enregistrements

**Files :** Create `js/core/fusion.js`, `tests/unit/fusion.test.js`

**Interfaces :**
- Produces : `fusionner(a: Rec[], b: Rec[]): Rec[]` (union par `id`, `majLe` le plus récent gagne, égalité → `appareil` le plus grand, résultat trié par `id`) ; `gagnant(x: Rec, y: Rec): Rec`.

- [ ] **Step 1 : tests rouges** :
  - union de `[{id:'a'}]` et `[{id:'b'}]` → 2 enregistrements
  - même `id`, `majLe` plus récent gagne, dans les deux ordres d'appel (commutativité : `deepEqual(fusionner(a,b), fusionner(b,a))`)
  - `fusionner(x, x)` deep-égal à `x` trié (idempotence)
  - une pierre tombale plus récente l'emporte ; une pierre tombale plus ancienne perd contre une modification plus récente
  - test aléatoire : 200 tirages de deux listes, aucun `id` présent en entrée n'est absent en sortie
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Fusion des enregistrements`.

### Task 4 : tendance de poids

**Files :** Create `js/core/tendance.js`, `tests/unit/tendance.test.js`, `tests/unit/series.js` (générateurs fictifs partagés)

**Interfaces :**
- Consumes : `joursEntre`, `ecartJours` (tâche 1).
- Produces :
  - `serieTendance(mesures: {id:jour, poids?, poidsConfirme?}[], jusquA: string): {jour, poids: number|null, tendance: number, aConfirmer: boolean}[]` (du premier jour pesé à `jusquA`, un élément par jour)
  - `tendanceAu(serie, jour): number|null`
  - `pente(serie, jour, n = 14): {kgSemaine, pctSemaine}|null` (régression linéaire, `null` si < 7 jours)
  - `tests/unit/series.js` : `seriePoids({debut, jours, depart, kgParSemaine, bruit, graine, trous})` → mesures fictives déterministes.

- [ ] **Step 1 : tests rouges** :
  - poids constant 80 → tendance 80 partout, pente 0
  - 80 puis 81 le lendemain → tendance `80.1`
  - jour sans pesée → tendance reportée
  - pesée à 84 avec tendance 80 → `aConfirmer: true`, tendance inchangée ; avec `poidsConfirme: true` → prise en compte
  - série linéaire −0,5 kg/sem, bruit ±0,4, 60 jours → `pente` entre −0,6 et −0,4 kg/sem
  - série traversant le 25/10 sans trou → un seul élément par jour
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 8.1). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Tendance de poids`.

### Task 5 : dépense

**Files :** Create `js/core/depense.js`, `tests/unit/depense.test.js`

**Interfaces :**
- Consumes : `serieTendance`, `tendanceAu` (tâche 4), `ajouterJours`, `age` (tâche 1).
- Produces :
  - `FACTEURS = {sedentaire:1.2, leger:1.375, modere:1.55, eleve:1.725}`
  - `metabolismeBase({sexe:'h'|'f', poidsKg, tailleCm, age}): number` (Mifflin-St Jeor, f : −161)
  - `jourValide(kcal: number, statut: 'auto'|'complet'|'incomplet'): boolean`
  - `estimerDepense({jour, apports: Map<jour, kcal>, statuts: Map<jour, statut>, serie, depenseRetenue}): {valeur, mesuree: number|null, joursValides, pesees, apportsMoyens, deltaKg, misAJour: boolean, raison: string|null, explication: string[]}`

- [ ] **Step 1 : tests rouges** :
  - `metabolismeBase({sexe:'h', poidsKg:80, tailleCm:180, age:30})` → `1780`
  - `jourValide(999,'auto')` false ; `(1000,'auto')` true ; `(600,'complet')` true ; `(2500,'incomplet')` false
  - série fictive : apports 2 200 constants 21 jours, tendance de 81,0 à 80,2 sur la fenêtre → `mesuree ≈ 2200 + 0.8/21*7700` (±1), `valeur = 0.5*retenue + 0.5*mesuree`
  - 13 jours valides → `misAJour: false`, `valeur === depenseRetenue`, `raison` contient `13` et `14`
  - 7 pesées → `misAJour: false`, raison sur les pesées
  - jours non saisis absents de `apports` : la moyenne ne les compte pas comme zéro
  - `explication` contient les apports moyens, l'écart de tendance, la dépense mesurée et la formule finale
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 8.2 ; fenêtre = 21 jours finissant à `jour`). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Dépense adaptative`.

### Task 6 : bilan hebdomadaire

**Files :** Create `js/core/coach.js`, `tests/unit/coach.test.js`

**Interfaces :**
- Consumes : `metabolismeBase` (tâche 5), `semaineIso`, `lundiDe` (tâche 1).
- Produces :
  - `partGlucidesDepuis(cibles): number` (`4g/(4g+9l)`)
  - `proposerCibles({depense, tendanceKg, reglages, mb}): {cibles:{kcal,prot,gluc,lip,fib}, deficit, plancherKcal: boolean, plancherLipides: boolean, explication: string[]}`
  - `bilanDu(jour, jourBilan, bilans: Bilan[], premierJourDonnees): {semaine: string}|null` (dû si jour ≥ jour de bilan de la semaine, pas déjà décidé, ≥ 14 jours depuis le premier jour de données)
  - `resumeSemaine({semaine, entrees, mesures, serie}): {apportsMoyens, joursSaisis, protMoyennes, fibMoyennes, deltaTendance, grignotages}`

- [ ] **Step 1 : tests rouges** :
  - `deficit` pour tendance 80, rythme 0,5 → `440`
  - dépense 2 500, prot 150, `partGlucides` 0,6 → kcal `2060`, gluc `(2060-600)*0.6/4`, lip `(2060-600)*0.4/9` (arrondis à l'unité), fib 30
  - kcal sous le métabolisme de base → kcal = mb, `plancherKcal: true`, phrase d'explication
  - lipides < 0,6 × 80 = 48 g → lip 48, glucides réduits d'autant, `plancherLipides: true`
  - protéines identiques à `reglages.cibles.prot` quelle que soit la dépense
  - `bilanDu('2026-11-23', 1, [], '2026-11-01')` → `{semaine:'2026-W47'}` ; déjà décidé → `null` ; premier jour de données le 15/11 → `null`
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 8.3). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Bilan hebdomadaire`.

### Task 7 : origine des protéines et grignotage

**Files :** Create `js/core/proteines.js`, `js/core/grignotage.js`, `tests/unit/proteines.test.js`, `tests/unit/grignotage.test.js`

**Interfaces :**
- Produces :
  - `ORIGINES = ['legumineuses','soja','cereales','laitiers','oleagineux','autres']`
  - `classerCiqual(nom: string, ssgrp: string): origine` ; `classerOff(nom: string, tags: string[]): origine`
  - `repartition(entrees): Record<origine, number>` (grammes de protéines)
  - `statsGrignotage(entrees, jourFin, nbJours): {nombre, kcal, part, parCreneau: Record<'0-2'..'22-24', n>, parRaison, topAliments: {nom,n}[], semainePrecedente: {nombre,kcal}}`
  - `phraseGrignotage(stats): string` (constat neutre, § 11)

- [ ] **Step 1 : tests rouges** : « Tofu nature » → soja ; « Seitan » → cereales ; « Lentille corail, cuite » → legumineuses ; « Whey » et « Skyr nature » → laitiers ; « Amande » → oleagineux ; OFF `['en:dairies']` → laitiers ; `statsGrignotage` sur 4 entrées fictives (3 entre 16 h et 18 h, raison faim) → `nombre 4`, créneau `'16-18'` = 3, raison dominante `faim` ; `phraseGrignotage` contient « 16 h et 18 h » et « faim ».
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter ; les codes de sous-groupe Ciqual viennent de `alim_grp_2025_11_03.xml` (tâche 8) : écrire la table `ssgrp → origine` en tête de `proteines.js`, mots-clés prioritaires (§ 8.4). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Origine des protéines, grignotage`.

### Task 8 : table Ciqual embarquée

**Files :** Create `tools/ciqual.mjs`, `data/ciqual.json`, `tests/unit/ciqual.test.js`

**Interfaces :**
- Produces : `data/ciqual.json` = `{version:'Ciqual 2025 (03/11/2025)', licence:'CC-BY 4.0', colonnes:['code','nom','ssgrp','kcal','prot','gluc','lip','fib'], lignes:[[…]]}` ; `lireTeneur(texte): number|null` exportée par `tools/ciqual.mjs`.

- [ ] **Step 1 : tests rouges** : `lireTeneur(' 12,5 ')` → 12.5 ; `'traces'` → 0 ; `'< 0,5'` → 0.25 ; `'-'` → null ; `data/ciqual.json` : > 3 000 lignes, aucune kcal `NaN`, présence de lignes dont le nom contient « Tofu », « Pois chiche », « Lentille », « Seitan », « Tempeh », « Flocon d'avoine », « Beurre de cacahuète » (ou « d'arachide »).
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 :** script : télécharge dans `tools/cache/` (ignoré par Git) depuis `https://zenodo.org/api/records/17550133/files/<nom>/content` les fichiers `alim_2025_11_03.xml`, `alim_grp_2025_11_03.xml`, `compo_2025_11_03.xml` ; analyse en flux ligne à ligne (balises une par ligne, 69 Mo) ; constituants 328, 25000, 31000, 40000, 34100. Lancer `npm run ciqual`.
- [ ] **Step 4 :** PASS ; vérifier `ls -l data/ciqual.json` < 400 Ko.
- [ ] **Step 5 :** commit `Table Ciqual 2025 embarquée`.

### Task 9 : recherche unifiée

**Files :** Create `js/core/recherche.js`, `tests/unit/recherche.test.js`

**Interfaces :**
- Consumes : `data/ciqual.json` (tâche 8), forme `Aliment`.
- Produces :
  - `normaliser(texte): string[]` (mots, sans accents ni mots vides, singulier simple)
  - `ciqualVersAliments(json): Aliment[]` (`id: 'ciqual:'+code`, `source:'ciqual'`, `origineProt` via `classerCiqual`)
  - `creerIndex(aliments: Aliment[]): Index` ; `ajouterAIndex(index, aliment)`
  - `chercher(index, requete: string, {usages: Map<id,{n, dernier}>, limite = 30}): {aliment, score}[]`

- [ ] **Step 1 : tests rouges** sur la vraie table : chacune des 8 requêtes du § 14 (« tofu », « pois chiches cuits », « skyr », « lentilles corail », « seitan », « tempeh », « flocons d'avoine », « beurre de cacahuète ») a une correspondance pertinente dans les 5 premiers (skyr : accepter un aliment perso fictif ajouté à l'index) ; « pates » trouve « Pâtes » ; un aliment avec `usages` n=10 passe devant un aliment de même score ; temps de `chercher` sur 3 500 aliments < 100 ms (moyenne de 20 appels).
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 9.4 ; index inversé par préfixe). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Recherche d'aliments`.

### Task 10 : phrase libre, plats types, portions

**Files :** Create `js/core/phrase.js`, `data/plats.json`, `data/portions.json`, `tests/unit/phrase.test.js`

**Interfaces :**
- Consumes : `chercher`, `creerIndex` (tâche 9), `lireQuantite` (tâche 2).
- Produces :
  - `data/plats.json` : `[{id, nom, synonymes: string[], portionG, p100, origineProt, estimation: bool}]` (~80, § 10.4) ; chargés comme aliments `source:'plat'` avec portion `{id:'portion', g: portionG}`
  - `data/portions.json` : `[{cle: code Ciqual | mot-clé, portions:[{id,nom,g}]}]` (~80, § 9.3) ; `portionsPour(aliment, table): portion[]`
  - `analyserPhrase(texte, index): {segment, qte, unite, facteur, choix: Aliment[] (≤ 4), confiance: number}[]`
  - `consigneClaude(texte): string` ; `extraireJson(texte): object|null` (premier bloc `{…}` valide, accepte un bloc ```json)
  - `lignesDepuisJson(obj): Ligne[]` (format `{aliments:[{nom,g,kcal,prot,gluc,lip,fib,origineProt}]}`)

- [ ] **Step 1 : tests rouges** :
  - « curry pois chiches riz, grosse portion et un skyr » → 2 segments ; le 1er : choix[0] = plat curry de pois chiches, `facteur 1.3` ; le 2e : skyr, `qte 1`
  - « 200 g de lentilles » → `qte 200`, `unite 'g'`
  - « deux falafels » → `qte 2` ; « un demi avocat » → `qte 0.5`
  - mot inconnu « zorglub » → `confiance` < 0,5
  - `extraireJson('Voici :\n```json\n{"aliments":[]}\n```')` → `{aliments:[]}` ; texte sans JSON → `null`
  - chaque plat de `plats.json` a `portionG > 0` et `p100.kcal > 0` ; chaque portion `g > 0`
- [ ] **Step 2 :** FAIL. **Step 3 :** écrire les deux fichiers de données et `phrase.js`. **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Saisie en phrase, plats types, portions`.

### Task 11 : suggestions

**Files :** Create `js/core/suggestions.js`, `tests/unit/suggestions.test.js`

**Interfaces :**
- Consumes : `valeurs` (tâche 2).
- Produces : `habituels(entrees, aliments, jour, repas?): {aliment, qte, unite, n}[]` (30 jours, tri fréquence, filtre par repas si fourni) ; `suggerer({restant, habituels}): {items:{aliment,qte,unite}[], prot, kcal}[]` (≤ 3, vide si `restant.prot < 20`).

- [ ] **Step 1 : tests rouges** : restant `{prot:40, kcal:400}`, habituels skyr 250 g (25 g P, 150 kcal), whey 30 g (24 g P, 120 kcal), chips 50 g (3 g P, 270 kcal) → première suggestion = skyr + whey ; aucune suggestion ne dépasse 440 kcal ; restant prot 15 → `[]`.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 11 ; combinaisons de 1 ou 2 parmi les 20 premiers habituels). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Suggestions`.

### Task 12 : lecture des envois du raccourci

**Files :** Create `js/core/inbox.js`, `tests/unit/inbox.test.js`

**Interfaces :**
- Consumes : rien d'autre que la forme `Mesure`/`Seance` (§ 6.1).
- Produces :
  - `jourCivil(dateIso: string): string` (jour civil local de l'horodatage : pas de coupure à 4 h pour une pesée)
  - `lireNombre(v): number|null` (« 80,2 kg », « 18,4 % », 80.2, « » → null)
  - `lireEnvoi(json): {poids:{jour, heure, kg}[], gras:{jour, heure, pct}[], seances: Seance[], ignores: number}`
  - `integrerEnvoi(envoi, mesures: Mesure[], seances: Seance[], maintenant: string): {mesures, seances, resume:{poids, gras, seances, ignores}}`

- [ ] **Step 1 : tests rouges** : format du § 7.1 lu correctement ; `kg: "80,2"` → 80.2 ; deux pesées le même jour (06:58 et 19:00) → 06:58 retenue ; mesure existante `sources.poids:'manuel'` non écrasée ; même envoi intégré deux fois → mêmes mesures et séances (pas de doublon) ; `seances` absent → aucun plantage ; valeur illisible → `ignores` +1.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Envois du raccourci`.

### Task 13 : base locale

**Files :** Create `js/data/db.js`, `tests/unit/db.test.js`

**Interfaces :**
- Produces :
  - `MAGASINS_SYNC = ['aliments','entrees','repasTypes','jours','mesures','seances','reglages','bilans']` ; locaux : `secrets`, `cacheOff`, `etatSync`, `appareil`
  - `fichierDe(magasin, rec): string` (§ 6.2 : `entrees` et `jours` → `journal/AAAA-MM.json` ; `seances` → `seances/AAAA.json` ; `repasTypes` → `repas-types.json` ; sinon `<magasin>.json`)
  - `ouvrirBase({nom = 'suivimacro', idb = indexedDB, horloge = () => new Date().toISOString()}): Promise<Base>`
  - `Base` : `lire(magasin, id)`, `tous(magasin, {avecSupprimes = false})`, `parIndex(magasin, index, valeur)` (index `jour` sur `entrees`), `ecrire(magasin, rec)` (pose `majLe` et `appareil`, marque `fichierDe` à envoyer), `supprimer(magasin, id)` (pierre tombale), `fusionnerFichier(chemin, recs)` (applique `fusionner` magasin par magasin, ne marque rien à envoyer), `enregistrementsDuFichier(chemin): Rec[]`, `aEnvoyer(): string[]`, `envoye(chemin, sha)`, `etat(chemin)`, `secret(cle)`, `poserSecret(cle, v)`, `exporter(): object`, `importer(obj)` (fusion), `surChangement(fn)`.

- [ ] **Step 1 : tests rouges** (avec `fake-indexeddb`) : écrire puis lire ; `supprimer` laisse une pierre tombale invisible dans `tous()` ; `ecrire` d'une entrée du 2026-11-23 → `aEnvoyer()` contient `journal/2026-11.json` ; `fusionnerFichier` ne marque rien ; `exporter` puis `importer` dans une base vide → mêmes enregistrements ; `secrets` absent de `exporter()`.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Base locale IndexedDB`.

### Task 14 : client du dépôt GitHub

**Files :** Create `js/data/depot.js`, `tests/unit/faux-github.js`, `tests/unit/depot.test.js`

**Interfaces :**
- Produces :
  - `creerDepot({jeton, proprietaire = 'gaetgalc', nom = 'SuiviMacro-data', branche = 'main', fetch}): Depot`
  - `Depot` : `arbre(): Promise<Map<chemin, sha>>`, `lire(chemin): Promise<{texte, sha}|null>`, `ecrire(chemin, texte, sha?): Promise<sha>`, `supprimer(chemin, sha)`, `tester(): Promise<{ok, message}>`
  - erreurs : `ConflitDepot` (409/422), `JetonRefuse` (401/403), `HorsLigne` (échec réseau)
  - `encoder(texte): base64` / `decoder(base64): texte` (UTF-8 via `TextEncoder`/`TextDecoder`, base64 avec retours à la ligne tolérés)
  - `tests/unit/faux-github.js` : `fauxGithub()` → `{fetch, fichiers: Map, ecrireDepuisAilleurs(chemin, texte)}` imitant `GET git/trees`, `GET/PUT/DELETE contents` (sha = hash du contenu, 409 si sha périmé, 404, 401 si mauvais jeton).

- [ ] **Step 1 : tests rouges** : aller-retour `encoder/decoder` sur « Pâtes complètes, crème, œuf » ; `ecrire` puis `lire` ; `ecrire` avec sha périmé → `ConflitDepot` ; mauvais jeton → `JetonRefuse` ; `arbre()` liste les sha ; en-têtes envoyés : `Authorization: Bearer`, `Accept: application/vnd.github+json`.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Client du dépôt de données`.

### Task 15 : synchronisation

**Files :** Create `js/data/sync.js`, `tests/unit/sync.test.js`

**Interfaces :**
- Consumes : `Base` (tâche 13), `Depot` (tâche 14), `lireEnvoi`, `integrerEnvoi` (tâche 12).
- Produces : `creerSync({base, depot, attendre = ms => …}): Sync` ; `Sync` : `recevoir(): Promise<{fichiers: n}>`, `envoyer(): Promise<{envoyes: n, enAttente: n}>`, `integrerInbox(): Promise<resume|null>`, `synchroniser()` (recevoir → inbox → envoyer), `etat(): {enAttente, derniereReception, erreur: null|'jeton'|'reseau'|'conflit'}`, `surEtat(fn)`. Format fichier : `{version:1, enregistrements:[…]}`, `JSON.stringify(obj, null, 1)`, trié par `id`.

- [ ] **Step 1 : tests rouges** (deux bases `fake-indexeddb` + un `fauxGithub`) :
  - A ajoute une entrée, `synchroniser` ; B `synchroniser` → B la voit
  - A et B ajoutent chacun une entrée au même mois hors ligne, puis synchronisent dans n'importe quel ordre → les deux ont les deux entrées (aucune perte)
  - A supprime, synchronise ; B synchronise → supprimée chez B
  - `ecrireDepuisAilleurs` entre le `GET` et le `PUT` → 409 → nouvel essai réussi, rien perdu
  - jeton refusé → `etat().erreur === 'jeton'`, les modifications restent en attente
  - fichier `inbox/…json` déposé → intégré dans `mesures.json`, puis fichier inbox supprimé ; deuxième `synchroniser` → aucun doublon
  - un nom accentué fait l'aller-retour A → dépôt → B à l'identique
  - `recevoir` sans changement d'arbre → aucun `GET contents`
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 7). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Synchronisation`.

### Task 16 : Open Food Facts, IA, bibliothèques embarquées

**Files :** Create `tools/vendor.mjs`, `vendor/zxing.js`, `vendor/anthropic.js`, `vendor/LICENCES.md`, `js/data/off.js`, `js/data/ia.js`, `tests/unit/off.test.js`, `tests/unit/ia.test.js`

**Interfaces :**
- Consumes : `classerOff` (tâche 7), `kcalDepuisMacros` (tâche 2), `lignesDepuisJson` (tâche 10).
- Produces :
  - `vendor/zxing.js` (ESM : `BrowserMultiFormatReader` ou équivalent de `@zxing/library` exporté) ; `vendor/anthropic.js` (ESM : export par défaut `Anthropic`) — produits par `esbuild` (`bundle`, `format: 'esm'`, `platform: 'browser'`, `minify`)
  - `creerOff({fetch, base}): {produit(code): Promise<Aliment|null>, chercher(q, {signal}): Promise<Aliment[]>}` (cache `cacheOff` 30 jours)
  - `versAliment(produitOff): Aliment|{incomplet: true, brut}` (kcal depuis `energy-kcal_100g`, sinon `energy_100g`/4,184, sinon macros ; nom `product_name_fr` > `product_name` ; `brands` chaîne ou tableau ; portion depuis `serving_quantity`)
  - `SCHEMA_ESTIMATION` (JSON Schema du format § 10.4, `additionalProperties: false`)
  - `creerIa({cle, Anthropic}): {estimerPhrase(texte), estimerPhoto(base64, type), tester()}` → `Ligne[]` ; erreurs `IaRefus`, `IaCle`, `IaReseau`
  - `reduireImage(fichier, max = 1568): Promise<{base64, type:'image/jpeg'}>` (navigateur seulement, non testé sous Node)

- [ ] **Step 1 :** `tools/vendor.mjs`, `npm run vendor` ; vérifier que `node -e "import('./vendor/anthropic.js').then(m=>console.log(typeof m.default))"` affiche `function`. `vendor/LICENCES.md` : noms, versions, licences.
- [ ] **Step 2 : tests rouges** :
  - `versAliment` sur une fiche complète fictive → `p100` exact ; sans `energy-kcal_100g` mais `energy_100g: 418.4` → kcal 100 ; sans énergie mais avec macros → kcal 4/4/9 ; sans rien → `{incomplet: true}` ; `brands: ['A','B']` → `'A, B'`
  - `produit` : 2e appel du même code → aucun `fetch` (cache) ; 404 / `status: 0` → `null`
  - `chercher` : URL contient `langs=fr` et `page_size=20`
  - `creerIa` avec un faux `Anthropic` : la requête porte `model: 'claude-opus-5-5'`, `output_config.effort: 'low'`, `output_config.format.type: 'json_schema'`, `fallbacks: 'default'` et la bêta `server-side-fallback-2026-07-01` ; `stop_reason: 'refusal'` → `IaRefus` ; la requête ne contient que la phrase (aucun poids, aucune cible)
- [ ] **Step 3 :** FAIL. **Step 4 :** implémenter (client : `new Anthropic({apiKey: cle, dangerouslyAllowBrowser: true})`, `client.beta.messages.create`). **Step 5 :** PASS.
- [ ] **Step 6 :** commit `Open Food Facts, IA, bibliothèques embarquées`.

### Task 17 : coquille de l'app, installation, hors connexion

**Files :** Create `index.html`, `manifest.webmanifest`, `sw.js`, `icons/icon-180.png`, `icons/icon-192.png`, `icons/icon-512.png`, `css/app.css`, `js/app.js`, `js/ui/composants.js`, `tools/serveur.mjs`, `tests/e2e/outils.js`, `tests/e2e/coquille.test.js`

**Interfaces :**
- Consumes : `ouvrirBase` (13), `creerSync`/`creerDepot` (14-15).
- Produces :
  - `js/app.js` : `contexte = {base, sync, ciqualIndex (chargé à la demande), jour()}` ; routeur par ancre `#/accueil`, `#/journal/:jour`, `#/tendances`, `#/reglages[/section]`, `#/bilan/:semaine`, `#/bienvenue` ; `enregistrerEcran(nom, {rendre(racine, params, contexte)})`
  - `js/ui/composants.js` : `feuille(contenu): {fermer}` (panneau du bas), `puces(options, choix, surChoix)`, `bandeau(texte, {action, duree})`, `explication(lignes)` (fenêtre « d'où vient ce chiffre »), `graphiqueLigne(svg, series, options)`, `barreProgression(valeur, cible)`, `pastilleSync(etat)`
  - `tools/serveur.mjs` : serveur statique Node qui sert la racine du dépôt sous `/SuiviMacro/` (port en argument)
  - `tests/e2e/outils.js` : `demarrer()` → `{url, page, contexte, fermer}` (serveur + Chromium, appareil `iPhone 13`, toutes les requêtes externes interceptées : faux GitHub, faux OFF, faux Anthropic) ; `fauxReseau(page, {github, off, anthropic})`
- [ ] **Step 1 : test rouge e2e** `coquille.test.js` : la page se charge sous `/SuiviMacro/`, barre d'onglets à 5 éléments, aucune erreur console, largeur 375 sans défilement horizontal ; après un premier chargement, `context.setOffline(true)` + rechargement → l'app s'affiche (service worker).
- [ ] **Step 2 :** `npm run e2e` → FAIL.
- [ ] **Step 3 :** implémenter : `index.html` (viewport `viewport-fit=cover`, balises `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `apple-touch-icon`), manifeste (`display: standalone`, `start_url: './'`, `scope: './'`, fond et thème sombres), `sw.js` (cache versionné `suivimacro-vN`, liste explicite des fichiers, cache d'abord puis mise à jour, message « mise à jour disponible »), `css/app.css` (variables du thème sombre, `env(safe-area-inset-*)`), icônes générées (lettre ou motif simple, PNG). Pour l'esthétique : appliquer les skills `frontend-design` et `hallmark`. Demander `navigator.storage.persist()` au démarrage.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Coquille, installation, hors connexion`.

### Task 18 : première ouverture et réglages

**Files :** Create `js/ui/bienvenue.js`, `js/ui/reglages.js`, `tests/e2e/bienvenue.test.js`

**Interfaces :**
- Consumes : `metabolismeBase`, `FACTEURS` (5), `partGlucidesDepuis` (6), `Depot.tester` (14), `creerIa().tester` (16), `Base.exporter/importer` (13).
- Produces : réglages initialisés (`reglages` § 6.1 avec `depenseRetenue` = dépense initiale, `partGlucides` figée) ; mesure du jour avec le poids saisi (`sources.poids: 'manuel'`).

- [ ] **Step 1 : test rouge e2e** : nouvelle base → redirection `#/bienvenue` ; écran 1 affiché si non installé (`navigator.standalone` faux) avec « Sur l'écran d'accueil » et bouton Continuer ; profil fictif (h, 1990-01-01, 180 cm, 85 kg, modéré) → cibles préremplies (kcal = `round((mb × 1,55 − 0,005 × 85 × 1100)/10)*10`), modifiables ; « plus tard » pour le jeton → accueil ; Réglages : jeton fictif accepté par le faux GitHub (« Connecté »), refusé → message clair ; export télécharge un JSON ; date d'expiration du jeton à J+10 → bandeau d'avertissement ; import d'un export → données présentes ; À propos mentionne « Ciqual 2025 », « CC-BY 4.0 », « Open Food Facts », « ODbL ». Cas « dépôt déjà rempli » : faux GitHub avec `reglages.json` → étapes 2-3 sautées.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 12 Première ouverture et Réglages ; sections : profil, cibles + historique, synchronisation, IA, raccourci (dernier envoi + format + « Copier un exemple »), mes aliments / recettes / repas enregistrés (liste, modifier, supprimer), données, à propos). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Première ouverture et réglages`.

### Task 19 : feuille Ajouter, quantité, recettes, repas enregistrés

**Files :** Create `js/ui/ajouter.js`, `js/ui/quantite.js`, `js/ui/aliment.js` (fiche, création, recette), `js/data/aliments.js`, `tests/unit/aliments.test.js`, `tests/e2e/ajouter.test.js`

**Interfaces :**
- Consumes : `chercher`/`creerIndex` (9), `habituels` (11), `valeurs`/`restant`/`lireQuantite` (2), `repasSelonHeure`/`jourLogique` (1), `creerOff` (16), `portionsPour` (10).
- Produces :
  - `js/data/aliments.js` : `adopter(base, aliment): Aliment` (copie un aliment Ciqual/OFF/plat dans `aliments` au premier usage, ne duplique pas : même `source`+`ref`) ; `ajouterEntree(base, {aliment, qte, unite, jour, repas, heure, mode, grignotage}): Entree` (fige les valeurs, met à jour `derniere`, `utilisations`, `dernierUsage`) ; `ajouterRepasType(base, repasType, jour, repas): Entree[]` ; `annuler(base, ids)`
  - `ouvrirAjouter(contexte, {jour, repas?})` ; `ouvrirQuantite(contexte, aliment, {jour, repas, entree?})`
- [ ] **Step 1 : tests rouges unitaires** `aliments.test.js` : `adopter` deux fois le même aliment Ciqual → un seul enregistrement ; `ajouterEntree` fige kcal, et une modification ultérieure de l'aliment ne change pas l'entrée ; `derniere` = dernière quantité/unité.
- [ ] **Step 2 : tests rouges e2e** : + → champ de recherche actif, repas deviné selon une heure simulée (12:41 → Déjeuner) ; « tofu » → résultat Ciqual → quantité 100 g par défaut → Ajouter → bandeau « Ajouté · Annuler » ; rouvrir → tofu dans « Habituels au déjeuner », ⊕ l'ajoute en un geste avec 100 g ; Annuler retire l'entrée ; quantité « 1,5 » avec une portion → grammes corrects ; « Restant après » se met à jour pendant la frappe ; case Grignotage + puce « ennui » enregistrée ; recherche sans résultat → « Créer un aliment » ; recette de 2 ingrédients, 4 parts → ajout « 1 part » ; fiche d'un aliment modifiée → entrées passées inchangées, sauf si « Appliquer aussi aux entrées passées » est coché ; « Enregistrer ce repas » puis ajout en un geste ; ajout rapide 650 kcal « Resto midi ».
- [ ] **Step 3 :** FAIL. **Step 4 :** implémenter (§ 10.1, 10.2, 10.6, 10.7). Recherche OFF : section « Produits » chargée après les résultats locaux (400 ms, 3 caractères). **Step 5 :** PASS.
- [ ] **Step 6 :** commit `Ajout d'aliments`.

### Task 20 : code-barres

**Files :** Create `js/ui/scanner.js`, `tests/e2e/scanner.test.js`

**Interfaces :**
- Consumes : `vendor/zxing.js` (16), `creerOff().produit` (16), `ouvrirQuantite` (19).
- Produces : `ouvrirScanner(contexte, {jour, repas})`.

- [ ] **Step 1 : test rouge e2e** : caméra indisponible (pas de permission) → repli visible : champ « Code-barres » et bouton « Prendre une photo du code » ; saisie `3017620422003` avec faux OFF → feuille Quantité du produit ; code inconnu → création d'aliment avec le code retenu, et un second scan du même code retrouve cet aliment ; décodage d'une image PNG d'un EAN-13 générée dans le test (fixture `tests/e2e/fixtures/ean13.png`, créée par le test avec ZXing) via le champ fichier.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 10.3 ; arrêt du flux caméra à la fermeture). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Code-barres`.

### Task 21 : saisie en phrase et photo

**Files :** Create `js/ui/phrase.js`, `tests/e2e/phrase.test.js`

**Interfaces :**
- Consumes : `analyserPhrase`, `consigneClaude`, `extraireJson`, `lignesDepuisJson` (10), `creerIa` (16), `reduireImage` (16), `ajouterEntree` (19).
- Produces : `ouvrirPhrase(contexte, {jour, repas})`, `ouvrirPhoto(contexte, {jour, repas})`.

- [ ] **Step 1 : test rouge e2e** : sans clé, bouton Photo absent ; « curry pois chiches riz, grosse portion et un skyr » → 2 lignes éditables, rien ajouté avant « Valider » ; ligne à faible confiance surlignée avec 3 choix ; « Demander à Claude » copie un texte contenant la phrase et `"aliments"` ; coller une réponse JSON → lignes remplies ; avec clé fictive et faux Anthropic → la phrase part directement, lignes affichées ; réponse `refusal` → message en français et saisie sans IA toujours possible ; entrées validées enregistrées avec `mode: 'phrase'`.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 10.4, 10.5). **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Saisie en phrase et photo`.

### Task 22 : accueil et journal

**Files :** Create `js/ui/accueil.js`, `js/ui/journal.js`, `js/data/vues.js`, `tests/unit/vues.test.js`, `tests/e2e/accueil.test.js`

**Interfaces :**
- Consumes : `serieTendance`, `pente` (4), `estimerDepense`, `jourValide` (5), `bilanDu` (6), `repartition` (7), `suggerer`, `habituels` (11), `somme`, `restant` (2), `Base` (13).
- Produces : `js/data/vues.js` (assemble les données de la base pour les calculs) : `donneesCalcul(base, jour): Promise<{serie, apports: Map, statuts: Map, reglages, entreesDuJour, mesures, seancesDuJour}>` ; `etatAccueil(donnees, jour): {tendance, pente, depense, restant, totaux, cibles, suggestions, bilanDu, seances}`.

- [ ] **Step 1 : tests rouges unitaires** `vues.test.js` : base fictive de 30 jours → `etatAccueil` renvoie tendance, pente, dépense avec `explication`, restant cohérent avec les entrées du jour.
- [ ] **Step 2 : tests rouges e2e** : accueil dans l'ordre tendance → restant → journal (§ 12, maquette de l'interview) ; toucher la dépense ouvre son explication ; restant prot ≥ 20 g et habituels présents → suggestion, toucher [+] ajoute la combinaison ; séance du jour affichée « pour info » ; journal : jour précédent/suivant, modifier une entrée, balayer pour supprimer puis Annuler, « Copier vers aujourd'hui », journée < 1 000 kcal → « Journée complète ? » et choix enregistré dans `jours` ; saisie manuelle du poids, du tour de taille et d'une séance ; pesée « à confirmer » signalée avec boutons Confirmer / Ignorer (`poidsConfirme`).
- [ ] **Step 3 :** FAIL. **Step 4 :** implémenter. **Step 5 :** PASS.
- [ ] **Step 6 :** commit `Accueil et journal`.

### Task 23 : tendances et bilan

**Files :** Create `js/ui/tendances.js`, `js/ui/bilan.js`, `tests/e2e/bilan.test.js`

**Interfaces :**
- Consumes : `proposerCibles`, `resumeSemaine`, `bilanDu` (6), `estimerDepense` (5), `statsGrignotage`, `phraseGrignotage`, `repartition` (7), `donneesCalcul` (22), `graphiqueLigne` (17).
- Produces : enregistrement `Bilan` (§ 6.1) avec `calcul` = sortie de `estimerDepense` + `proposerCibles` ; mise à jour de `reglages.cibles` et `reglages.depenseRetenue` seulement sur Accepter/Modifier.

- [ ] **Step 1 : test rouge e2e** (base fictive de 28 jours, horloge au lundi) : bandeau du bilan sur l'accueil ; écran de bilan affiche chaque ligne de l'explication, anciennes et nouvelles cibles avec l'écart ; « Garder les actuelles » → cibles inchangées, bandeau disparu, bilan `refusee` enregistré ; sur une autre base, « Accepter » → nouvelles cibles sur l'accueil ; « Modifier » → protéines éditables, valeurs saisies retenues ; avant 14 jours de données → écran qui explique ce qui manque ; Tendances : graphiques poids (30/90/365), dépense, apports vs cible, fibres, origine des protéines, grignotage, historique des bilans, sans erreur console.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (§ 8.3, § 12). Aucune cible ne change ailleurs que dans ce flux et dans Réglages > Cibles. **Step 4 :** PASS.
- [ ] **Step 5 :** commit `Tendances et bilan`.

### Task 24 : parcours complet, garde-fous, guide

**Files :** Create `tests/e2e/parcours.test.js`, `tests/unit/secrets.test.js`, `docs/GUIDE.md` ; Modify `CLAUDE.md` (section « Où en est le projet »)

- [ ] **Step 1 : tests** :
  - `parcours.test.js` : § 14 de bout en bout — première ouverture → recherche → ajout direct d'un habituel → phrase → repas enregistré → hors connexion + rechargement → deux contextes de navigateur synchronisés par le même faux GitHub (ajouts croisés le même mois, aucune perte) → dépôt d'un envoi `inbox/` → poids affiché sur l'accueil → bilan accepté ; aucune erreur console ; **sans jeton ni clé** : tout le parcours local fonctionne, la pastille affiche « non synchronisé ».
  - `secrets.test.js` : parcourt les fichiers suivis par Git (`git ls-files`, hors `vendor/` et `data/ciqual.json`) et échoue sur `ghp_`, `github_pat_`, `sk-ant-` ou une adresse e-mail (sauf `noreply@anthropic.com`).
- [ ] **Step 2 :** `npm test && npm run e2e` → corriger jusqu'à PASS (`superpowers:systematic-debugging` sur tout échec).
- [ ] **Step 3 :** `docs/GUIDE.md` pas à pas, en français : activer GitHub Pages (Settings > Pages > branche `main`, dossier racine) ; installer sur l'iPhone (Safari > Partager > Sur l'écran d'accueil) ; créer le jeton fine-grained (dépôt `SuiviMacro-data` seul, Contents : lecture et écriture, durée maximale) et le saisir dans l'app installée ; construire le raccourci action par action (§ 7.1) et l'automatisation du matin ; clé API Anthropic facultative (console Anthropic, facturation à part de l'abonnement Pro). Mettre à jour `CLAUDE.md` (état : construit, prochaines étapes côté Gaëtan).
- [ ] **Step 4 :** commit `Parcours complet, garde-fous, guide`.

### Task 25 : vérification et publication

- [ ] **Step 1 :** `superpowers:verification-before-completion` : `npm test` et `npm run e2e` complets, sortie lue ; captures d'écran à 375 px (accueil, ajouter, quantité, journal, tendances, bilan) relues à l'œil.
- [ ] **Step 2 :** `/code-review` puis `/simplify` sur la branche ; corriger, relancer les tests.
- [ ] **Step 3 :** fusion directe dans `main` sans pull request (consigne de Gaëtan), push de `main` et de la branche de travail.
