# SuiviMacro : cahier des charges

Version 1, 23/11/2026. Source : `docs/INTERVIEW.md` (à lire avant ce document). Les choix marqués **[Claude]** sont des propositions de Claude, à valider par Gaëtan à la relecture ; tout le reste vient de l'interview.

> Dépôt public : aucun chiffre personnel ici. Les exemples chiffrés sont fictifs.

---

## 1. Intention

Un outil personnel de suivi nutritionnel dans l'esprit de MacroFactor : dépense adaptative, bilan hebdomadaire, saisie rapide. Gratuit, pour un régime végétarien à tendance vegan, avec une base d'aliments française, utilisé chaque jour sur iPhone depuis l'écran d'accueil.

L'enjeu : **l'équilibre entre facilité d'utilisation et exhaustivité**. Gaëtan abandonne l'outil si :

1. la saisie est trop lente ;
2. un aliment est introuvable ;
3. des données sont perdues ;
4. les cibles changent sans qu'il comprenne pourquoi.

Chacun de ces quatre points a une réponse explicite dans ce document (§ 14, critères d'acceptation).

Objectif de livraison : un site prêt à 99 %, peu de retouches.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**

- Ajouter un repas habituel en **3 gestes ou moins** depuis l'ouverture (+, toucher l'aliment, Ajouter).
- Ne jamais ressaisir : chaque aliment retient sa dernière quantité et son unité ; repas enregistrés, recettes, copie d'un repas d'un autre jour.
- Quatre façons de trouver un aliment : recherche (aliments bruts Ciqual hors connexion + produits Open Food Facts), code-barres, phrase libre, photo (photo seulement avec clé API).
- Tendance de poids lissée, dépense estimée à partir des données réelles, bilan hebdomadaire qui propose de nouvelles cibles **avec le calcul détaillé**, à accepter ou modifier.
- Suivi : calories, protéines, glucides, lipides, **fibres**, **origine des protéines** (légumineuses, soja, céréales, laitiers et œufs, oléagineux et graines, autres).
- Comprendre ses grignotages : marquer un ajout comme grignotage, avec une raison ; tendances par heure, raison, aliment.
- Suggestions pour combler le restant à partir des aliments habituels.
- Données synchronisées entre appareils par le dépôt privé `gaetgalc/SuiviMacro-data` ; poids, % de gras et séances arrivent seuls chaque matin par un raccourci iPhone.

**Non-objectifs**

- Micronutriments (B12, fer, etc.), eau, alcool.
- Ajout des calories d'activité au budget : les séances sont **affichées pour info** seulement.
- Budget différent selon les jours : **une seule cible, identique tous les jours**.
- Notifications et rappels (impossibles sans serveur sur iPhone).
- Collations planifiées, planification des repas à l'avance.
- Plusieurs utilisateurs, comptes, partage.
- Import d'un historique MacroFactor (Gaëtan ne l'a pas utilisé).

**Anti-objectifs** (ce qui ferait échouer l'outil même s'il « marche »)

- Une saisie qui demande de peser à chaque fois.
- Une cible qui bouge seule, ou dont le calcul n'est pas affiché.
- Une donnée écrasée par une synchronisation, ou perdue parce que le stockage du téléphone a été vidé.
- Un écran d'accueil chargé : la tendance, le restant, le journal, et c'est tout.
- Une fonction qui exige la clé API pour être utilisable (l'IA est un plus, jamais un prérequis).

## 3. Contraintes

- Site statique, **sans étape de compilation du site** : HTML, CSS, JavaScript en modules ES servis tels quels par GitHub Pages depuis `main` (`https://gaetgalc.github.io/SuiviMacro/`, donc tous les chemins sont **relatifs**, le site vit sous `/SuiviMacro/`).
- Bibliothèques tierces embarquées dans `vendor/`, récupérées par npm (jsdelivr est bloqué depuis l'environnement cloud).
- Dépôt du site public : aucune clé, aucun jeton, aucun e-mail, aucune donnée personnelle, ni dans le code ni dans les tests (données de test fictives).
- Données de Gaëtan dans `gaetgalc/SuiviMacro-data` (privé). Claude n'y lit ni n'écrit : les tests simulent l'API GitHub.
- Jeton GitHub et clé API Anthropic saisis dans le site, stockés sur l'appareil (IndexedDB), jamais envoyés ailleurs qu'à `api.github.com` et `api.anthropic.com`.
- iPhone, Safari, site ajouté à l'écran d'accueil : le stockage de l'app installée est **séparé** de celui de Safari ; tout se configure depuis l'app installée.
- Licences : Ciqual 2025 sous **CC-BY 4.0** (vérifié sur Zenodo le 23/11) ; Open Food Facts sous **ODbL** ; attribution des deux dans Réglages > À propos.

## 4. Approches

| Approche | Pour | Contre | Décision |
|---|---|---|---|
| **Site statique en modules ES + IndexedDB + dépôt GitHub privé** | Aucune compilation, gratuit, hors connexion, historique Git = sauvegarde complète, cohérent avec Cap 1000 | Synchronisation à écrire soi-même (fusion, conflits) | **Retenue** (décision 6 de l'interview) |
| React/Vite + même stockage | Composants, écosystème | Étape de compilation sans bénéfice pour Gaëtan, vendor plus lourd | Écartée |
| Base en ligne (Supabase, Firebase) | Synchronisation clé en main | Refusée par Gaëtan ; compte tiers, données hors de GitHub | Écartée |

Interface écrite à la main en JavaScript sans framework : quelques écrans, un petit routeur par ancre (`#/accueil`, `#/journal/2026-11-23`…), des fonctions de rendu par écran. Graphiques en SVG écrits à la main (pas de bibliothèque).

## 5. Architecture

```
index.html                 coquille unique, charge js/app.js
manifest.webmanifest       nom, icônes, display: standalone, thème sombre
sw.js                      service worker : cache de la coquille, de data/ et vendor/
icons/                     icône 180 px (apple-touch-icon), 192, 512
css/app.css                thème sombre, variables, safe-area iPhone
js/app.js                  démarrage, routeur, barre d'onglets
js/core/                   LOGIQUE PURE, sans DOM, testée sous Node
  dates.js                 jour logique (coupure à 4 h), semaines ISO, fuseau local
  nutrition.js             calcul des valeurs d'une quantité, sommes, restant
  tendance.js              poids lissé, pente
  depense.js               dépense initiale et adaptative, explication
  coach.js                 bilan hebdomadaire, nouvelles cibles, explication
  proteines.js             classement de l'origine des protéines
  recherche.js             normalisation, score, classement des résultats
  phrase.js                analyse d'une phrase libre
  suggestions.js           combinaisons pour combler le restant
  grignotage.js            statistiques de grignotage
  fusion.js                fusion d'enregistrements (synchronisation)
  inbox.js                 lecture tolérante des envois du raccourci
js/data/                   ACCÈS AUX DONNÉES ET AU RÉSEAU
  db.js                    IndexedDB (magasins § 6.1)
  depot.js                 client API GitHub (contents, trees)
  sync.js                  synchronisation (§ 7)
  off.js                   Open Food Facts (fiche, recherche, cache)
  ciqual.js                chargement de data/ciqual.json
  ia.js                    appels Claude (§ 10)
js/ui/                     un fichier par écran + composants (feuille, puces, graphique)
data/ciqual.json           table Ciqual 2025 réduite (généré, versionné)
data/plats.json            plats types pour la saisie en phrase
data/portions.json         portions usuelles (pièce, bol, cuillère…)
vendor/                    zxing (code-barres), SDK Anthropic (générés, versionnés)
tools/ciqual.mjs           XML Zenodo → data/ciqual.json (lancé à la main, une fois par version)
tools/vendor.mjs           npm → vendor/ (esbuild, un fichier ESM par bibliothèque)
tests/unit/*.test.js       node --test, logique pure + sync avec GitHub simulé
tests/e2e/*.spec.js        Playwright, largeur iPhone, réseau simulé
docs/GUIDE.md              mise en route pas à pas : Pages, jeton, raccourci, clé
package.json               dépendances de développement seulement
```

Règle de découpage : tout ce qui calcule est dans `js/core/`, en fonctions pures (entrées → sorties, dates passées en paramètre), importables par Node comme par le navigateur. `js/data/` reçoit `fetch` et la base par injection pour être testé sans réseau.

`esbuild` n'est utilisé que par `tools/vendor.mjs` pour produire des fichiers de `vendor/` ; le site lui-même n'est jamais compilé.

## 6. Données

### 6.1 Enregistrements

Tous les enregistrements synchronisés ont `id` (chaîne aléatoire, `crypto.randomUUID()`), `majLe` (horodatage ISO de la dernière modification) et, s'ils sont supprimés, `supprime: true` (pierre tombale, jamais effacée). Les valeurs nutritionnelles sont **pour 100 g** sauf mention contraire.

**Aliment** (magasin `aliments`)
```
{ id, source: 'ciqual'|'off'|'perso'|'recette',
  ref,                       // code Ciqual ou code-barres
  nom, marque?,
  p100: { kcal, prot, gluc, lip, fib },     // fib peut être null (inconnu)
  origineProt,               // § 9.4, déduite puis modifiable
  portions: [{ id, nom, g }],// ex. { nom: 'pot', g: 125 }
  derniere: { qte, unite },  // unite = 'g' ou id de portion
  favori: bool, utilisations: n, dernierUsage: date,
  recette?: { ingredients: [{ alimentId, g }], poidsCuitG?, nbPortions },
  majLe, supprime? }
```
Un aliment Ciqual ou Open Food Facts n'entre dans `aliments` qu'au premier usage (copie de ses valeurs) ; la table Ciqual et le cache Open Food Facts ne sont pas synchronisés.

**Entrée de journal** (magasin `entrees`)
```
{ id, jour: 'AAAA-MM-JJ', repas: 'petitdej'|'dejeuner'|'collation'|'diner',
  heure: 'HH:MM', alimentId?, nom,
  qte, unite, g,                          // g = grammes résolus
  kcal, prot, gluc, lip, fib, origineProt,// valeurs figées au moment de l'ajout
  mode: 'recherche'|'code'|'phrase'|'photo'|'rapide'|'repas'|'copie',
  grignotage: null | { raison: 'faim'|'ennui'|'stress'|'fatigue'|'social'|'envie'|'autre' },
  majLe, supprime? }
```
Les valeurs sont **figées** dans l'entrée **[Claude]** : modifier un aliment plus tard ne réécrit pas l'historique (ce qui fausserait la dépense passée). L'écran de l'aliment propose « Appliquer aussi aux entrées passées » si besoin.

**Repas enregistré** (magasin `repasTypes`) : `{ id, nom, items: [{ alimentId, qte, unite }], majLe, supprime? }`.

**Journée** (magasin `jours`) : `{ id: jour, statut: 'auto'|'complet'|'incomplet', note?, majLe }`. Sert à exclure une journée mal saisie du calcul de la dépense (§ 8.2).

**Mesure** (magasin `mesures`, une par jour) : `{ id: jour, poids?, grasPct?, tourTaille?, sources: {poids:'raccourci'|'manuel', …}, majLe }`.

**Séance** (magasin `seances`) : `{ id (début ISO + type), jour, type, debut, dureeMin, kcalActives?, source, majLe }`.

**Réglages** (enregistrement unique `reglages`, synchronisé) :
```
{ profil: { sexe, naissance, tailleCm, activite },  // activite = facteur PAL
  cibles: { kcal, prot, gluc, lip, fib, depuis },
  partGlucides,          // part des kcal hors protéines allant aux glucides, figée au départ
  rythmePct: 0.5,        // % du poids par semaine
  depenseRetenue,        // dernière dépense validée au bilan
  jourBilan: 1,          // lundi
  majLe }
```

**Bilan** (magasin `bilans`) : `{ id: 'AAAA-Wss', date, calcul: {…tout le détail § 8.3}, proposees, retenues, decision: 'acceptee'|'modifiee'|'refusee', majLe }`.

**Local seulement** (jamais synchronisé) : `secrets` (jeton GitHub, clé API), `cacheOff` (fiches et recherches, 30 jours), `etatSync` (sha connus, fichiers à envoyer), `appareil` (id de l'appareil).

### 6.2 Fichiers du dépôt de données

```
reglages.json           l'objet réglages
aliments.json           aliments perso, recettes, aliments déjà utilisés
repas-types.json
bilans.json
mesures.json            toutes les mesures (≈ 30 Ko par an)
seances/AAAA.json
journal/AAAA-MM.json    entrées + journées du mois
inbox/*.json            envois du raccourci, supprimés une fois intégrés
README.md               créé par Gaëtan
```
Chaque fichier est un objet `{ version: 1, enregistrements: [...] }`, JSON indenté de 1 espace (lisible, diff Git propre), trié par `id`.

## 7. Synchronisation

Principe : **IndexedDB fait foi sur l'appareil** ; le dépôt est le point de rencontre entre appareils et la sauvegarde (chaque écriture est un commit : tout l'historique est récupérable).

- **Fusion** (`core/fusion.js`) : union par `id` ; à `id` égal, l'enregistrement au `majLe` le plus récent gagne ; égalité → celui de l'appareil dont l'id est le plus grand (déterministe). Les pierres tombales participent comme les autres. Fonction pure, testée en priorité : commutative, idempotente, n'efface jamais un enregistrement sans pierre tombale.
- **Réception** : à l'ouverture, au retour au premier plan (`visibilitychange`) et toutes les 5 minutes app ouverte : `GET /repos/{o}/{r}/git/trees/main?recursive=1` (un seul appel), comparaison des `sha` avec `etatSync`, téléchargement des seuls fichiers changés (`GET contents`), fusion dans IndexedDB.
- **Envoi** : toute modification marque son fichier « à envoyer » ; envoi groupé 3 secondes après la dernière modification (et immédiatement au passage en arrière-plan) : `GET` du fichier (contenu + `sha`), fusion avec le local, `PUT` avec ce `sha`. Réponse 409/422 (quelqu'un a écrit entre-temps) → on recommence, 3 fois au plus, puis on garde en attente.
- **Hors connexion** : rien ne bloque ; la file d'attente part au retour du réseau. Une pastille discrète en haut d'écran indique « 3 modifications en attente » ou une erreur (jeton expiré : lien vers Réglages).
- **Encodage** : contenu en base64 UTF-8 (accents : passer par `TextEncoder`, pas `btoa` seul).
- **Première synchronisation d'un nouvel appareil** : téléchargement complet, puis fusion.
- **Jeton** : jeton « fine-grained » limité au dépôt `SuiviMacro-data`, permission Contents en lecture-écriture, durée la plus longue proposée. Saisi dans Réglages ; bouton « Tester » (lecture du dépôt). Date d'expiration saisie facultative → bandeau 14 jours avant **[Claude]**.
- **Protection contre la perte** : `navigator.storage.persist()` demandé au premier lancement ; rien n'est retiré du local avant confirmation d'envoi ; export JSON complet (tous les magasins synchronisés) et import (fusion, jamais remplacement) dans Réglages.

### 7.1 Raccourci iPhone (boîte de réception)

Le raccourci écrit **directement** dans le dépôt par l'API GitHub (décision 3 de l'interview), un fichier nouveau par envoi, sans lire avant d'écrire :

`PUT https://api.github.com/repos/gaetgalc/SuiviMacro-data/contents/inbox/AAAA-MM-JJTHH-MM-SS.json`
en-têtes `Authorization: Bearer <jeton>`, `Accept: application/vnd.github+json` ; corps `{ "message": "inbox", "content": "<base64 du JSON>" }`.

Contenu attendu (format tolérant, voir plus bas) :
```json
{ "version": 1, "envoye": "2026-11-24T07:05:00+01:00",
  "poids":  [{ "date": "2026-11-24T06:58:00+01:00", "kg": "80,2" }],
  "gras":   [{ "date": "2026-11-24T06:58:00+01:00", "pct": "18,4" }],
  "seances":[{ "debut": "2026-11-23T19:00:00+01:00", "fin": "...", "type": "Football",
               "dureeMin": 90, "kcal": "720" }] }
```
- `core/inbox.js` accepte nombres ou chaînes (virgule française, unité collée « 80,2 kg », « 18,4 % »), listes vides ou absentes, dates avec ou sans fuseau. Tout ce qui ne se lit pas est ignoré et signalé dans Réglages > Raccourci (« dernier envoi : 24/11 07:05, 1 poids, 0 gras, 1 séance, 1 valeur ignorée »).
- Plusieurs pesées un même jour : **la plus matinale** est retenue **[Claude]** ; une saisie manuelle n'est jamais écrasée par le raccourci.
- Intégration par le site à la réception : fusion dans `mesures.json` et `seances/AAAA.json`, envoi, **puis seulement** suppression des fichiers `inbox/` intégrés (`DELETE` avec leur `sha`). Idempotent : un fichier intégré deux fois ne crée pas de doublon (clés = jour, id de séance).
- `docs/GUIDE.md` décrit le raccourci action par action (Rechercher des échantillons de santé « Poids », « Masse grasse », « Entraînements » ; Dictionnaire ; Encoder en base64 ; Obtenir le contenu de l'URL en PUT) et l'automatisation quotidienne (heure fixe le matin, exécution sans demander). Le site affiche le format attendu et un bouton « Copier un exemple ».

## 8. Calculs

Toutes les fonctions sont dans `js/core/`, testées avec des séries fictives. Chaque résultat affiché à l'utilisateur est accompagné de son explication (objet `{ valeur, explication: [lignes] }`).

### 8.1 Tendance de poids (`tendance.js`)

- Moyenne mobile exponentielle quotidienne : `T(j) = T(j−1) + 0,1 × (P(j) − T(j−1))` ; jour sans pesée : `T(j) = T(j−1)` ; première valeur `T = P`. **[Claude]** (méthode de MacroFactor et du « Hacker's Diet », coefficient 0,1 ≈ lissage sur 2-3 semaines.)
- Pente affichée : régression linéaire de `T` sur les 14 derniers jours, en kg/semaine et en % du poids/semaine.
- Valeurs aberrantes : une pesée qui s'écarte de plus de 3 kg de la tendance est marquée « à confirmer », exclue tant qu'elle n'est pas confirmée **[Claude]**.

### 8.2 Dépense (`depense.js`)

- **Départ** : Mifflin-St Jeor (homme : `10 × poids + 6,25 × taille − 5 × âge + 5`) × facteur d'activité choisi à l'installation (1,2 sédentaire, 1,375 léger, 1,55 modéré, 1,725 élevé ; **1,55 proposé** pour 3-4 séances/semaine) **[Claude]**.
- **Journée valide pour le calcul** : statut `complet`, ou statut `auto` avec au moins 1 000 kcal saisies **[Claude]**. Une journée `auto` sous ce seuil est signalée dans le journal (« Journée complète ? Oui / Non »). Un jour non saisi est **exclu, jamais compté comme zéro**.
- **Dépense mesurée** sur la fenêtre des 21 derniers jours **[Claude]** : `moyenne des apports des jours valides − (T(fin) − T(début)) / 21 × 7 700`.
- **Estimation** : `0,5 × dépense retenue précédente + 0,5 × dépense mesurée`, si la fenêtre compte au moins 14 jours valides et au moins 8 pesées **[Claude]**. Sinon : dépense retenue inchangée, avec la raison (« 9 jours saisis sur 21, il en faut 14 »).
- Recalculée chaque jour pour l'affichage (accueil, Tendances) ; elle ne modifie les cibles qu'au bilan, après validation.

Exemple d'explication (fictif) :
```
Sur les 21 derniers jours (18 saisis) :
  apports moyens            2 150 kcal/j
  tendance 81,0 → 80,2 kg   −0,8 kg ≈ −293 kcal/j
  dépense mesurée           2 443 kcal/j
Estimation = ½ ancienne (2 600) + ½ mesurée (2 443) = 2 520 kcal/j
```

### 8.3 Bilan hebdomadaire (`coach.js`)

- Proposé le **lundi** (jour réglable), sur la semaine écoulée ; bandeau sur l'accueil jusqu'à décision. Rien ne change tant que Gaëtan n'a pas validé ; bilan ignoré = anciennes cibles conservées.
- Premier bilan possible après 14 jours de données ; avant, l'écran explique ce qui manque.
- **Déficit visé** = `rythmePct × T(aujourd'hui) × 7 700 / 7` kcal/j (0,5 % de 80 kg = 0,40 kg/sem ≈ 440 kcal/j).
- **Calories** = dépense estimée − déficit, arrondies à 10 kcal. Plancher : métabolisme de base (Mifflin-St Jeor sans facteur) ; s'il s'applique, l'écran le dit.
- **Protéines** : fixes (cible saisie), modifiables seulement à la main.
- **Glucides / lipides** : les kcal restantes (`calories − 4 × prot`) se répartissent selon `partGlucides`, calculée une fois à partir des cibles de départ (`4 × gluc / (4 × gluc + 9 × lip)`). Plancher lipides 0,6 g/kg de tendance, pris sur les glucides si besoin **[Claude]**.
- **Fibres** : cible fixe, 30 g par défaut (repère ANSES adulte) **[Claude]**.
- Écran : la dépense (calcul § 8.2), le déficit, l'ancienne et la nouvelle cible pour chaque macro avec l'écart, et le bilan de la semaine (poids, apports moyens, jours saisis, protéines moyennes, fibres, grignotages). Trois boutons : **Accepter**, **Modifier** (champs éditables, protéines comprises), **Garder les actuelles**. Le bilan est enregistré avec sa décision ; l'historique des bilans est consultable.
- Toute modification manuelle des cibles hors bilan demande une raison facultative et apparaît dans l'historique.

### 8.4 Origine des protéines (`proteines.js`)

Six catégories : légumineuses, soja, céréales, laitiers et œufs, oléagineux et graines, autres.
- Ciqual : par sous-groupe (`alim_ssgrp_code`, table `alim_grp`), puis par mots-clés dans le nom qui l'emportent (tofu, tempeh, edamame, « soja » → soja ; seitan → céréales ; whey, skyr, fromage → laitiers et œufs).
- Open Food Facts : par `categories_tags` (`en:legumes`, `en:soy…`, `en:dairies`, `en:nuts`…) puis mots-clés.
- Toujours modifiable sur la fiche de l'aliment. Affiché en barre empilée par semaine dans Tendances, et en part du jour dans le journal.

### 8.5 Nutrition (`nutrition.js`)

`valeurs(aliment, qte, unite)` : grammes = `qte` si `g` ou `ml` (1 ml compté comme 1 g), sinon `qte × portion.g` ; puis `p100 × g / 100`, arrondis à l'affichage seulement (kcal à l'unité, macros à 0,1 g dans les calculs, à l'unité à l'écran). Recette : `p100` = somme des ingrédients / poids cuit (ou / poids cru total si non renseigné) ; portion « 1 part » = poids total / nbPortions.

## 9. Aliments

### 9.1 Ciqual (aliments bruts, hors connexion)

- Source : Zenodo, enregistrement `17550133` (concept `17550132`), table Ciqual 2025 du 03/11/2025, fichiers `alim_2025_11_03.xml`, `alim_grp_2025_11_03.xml`, `compo_2025_11_03.xml` (≈ 69 Mo).
- `tools/ciqual.mjs` produit `data/ciqual.json` : par aliment `[code, nom, sousGroupe, kcal, prot, gluc, lip, fib]`. Constituants : 328 énergie kcal (Règlement UE 1169/2011), 25000 protéines (N × facteur de Jones), 31000 glucides, 40000 lipides, 34100 fibres. Teneurs : virgule décimale, « traces » → 0, « < x » → x/2, « - » ou absent → null. Cible ≈ 3 500 lignes, < 400 Ko (compressé par Pages).
- Le XML source n'est pas versionné ; la commande et la version sont notées en tête du script et dans Réglages > À propos.

### 9.2 Open Food Facts (produits)

- Fiche : `GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=code,product_name,product_name_fr,brands,quantity,serving_size,serving_quantity,categories_tags,nutriments`.
- Recherche : `GET https://search.openfoodfacts.org/search?q=…&langs=fr&page_size=20&fields=code,product_name,brands,nutriments,categories_tags`.
- Recherche à la frappe temporisée (400 ms, 3 caractères minimum), lancée seulement si les résultats locaux sont insuffisants ou à la demande (« Chercher dans les produits ») ; cache 30 jours ; une requête à la fois (la précédente est annulée).
- Produit sans kcal : calculé depuis les macros (4/4/9) si possible, sinon proposé à la saisie manuelle des valeurs de l'étiquette (enregistrées comme aliment perso, une seule fois).
- `serving_quantity` devient une portion « portion (x g) ».

### 9.3 Portions (`data/portions.json`)

Environ 80 portions usuelles **[Claude]** liées à un code Ciqual ou à un mot-clé : œuf 50 g, tranche de pain 35 g, bol de riz cuit 180 g, cuillère à soupe d'huile 10 g, cuillère à soupe de beurre de cacahuète 15 g, pot de yaourt 125 g, banane 120 g, dose de whey 30 g, poignée d'amandes 25 g, etc. Gaëtan ajoute sa propre portion sur n'importe quel aliment en une ligne (« 1 bol = 300 g »), retenue pour toujours.

### 9.4 Recherche unifiée (`recherche.js`)

- Normalisation : minuscules, sans accents, pluriels simples, mots vides retirés (de, du, la, aux…).
- Score : tous les mots trouvés (préfixe accepté) > ordre > longueur du nom ; bonus forts pour les aliments déjà utilisés (fréquence, récence) et les favoris ; les aliments bruts Ciqual « cru/cuit » sont tous deux proposés.
- Ordre d'affichage : mes aliments et recettes, puis Ciqual, puis produits Open Food Facts (section séparée, chargée après).
- Rien trouvé : « Créer un aliment » (nom prérempli, valeurs pour 100 g ou par portion), ou « Estimer en phrase ».

## 10. Saisie

### 10.1 Feuille « Ajouter »

```
┌──────────────────────┐
│ Déjeuner ▾      12:41  │   repas deviné selon l'heure, modifiable
│ [ 🔍 Rechercher…     ] │   champ actif à l'ouverture
│ [Code] [Phrase] [Photo]│   Photo visible seulement avec une clé
│ [Rapide]               │
│ Habituels au déjeuner  │
│  Curry pois chiches 1 part  540 │  ⊕ = ajout direct, dernière quantité
│  Skyr nature 150 g      95 │
│ Repas enregistrés      │
│  Bol du midi (3)        690 │
│ Favoris …              │
└──────────────────────┘
```
- Repas deviné : avant 10 h 30 petit-déj, 10 h 30-14 h 30 déjeuner, 14 h 30-18 h 30 collation, après dîner **[Claude]**. Entre 0 h et 4 h, le jour est la veille.
- « Habituels » : aliments et repas ajoutés à ce repas sur les 30 derniers jours, par fréquence. Le bouton ⊕ ajoute directement avec la dernière quantité (**2 gestes**) ; toucher la ligne ouvre la quantité (**3 gestes**).
- Après chaque ajout : bandeau « Ajouté · Annuler » 5 s, la feuille reste ouverte pour enchaîner, le restant se met à jour en haut.

### 10.2 Quantité

```
┌──────────────────────┐
│ Tofu nature (Ciqual)   │
│  [ 150 ] [ g ▾ ]       │  unités : g, portions de l'aliment, + « ajouter une portion »
│  −  100 · 150 · 200  + │  raccourcis selon l'unité
│ 180 kcal · P 18 · G 3 · L 11 · F 1 │
│ Restant après : 860 kcal · P 41 g │
│ ☐ Grignotage           │  si coché : [faim][ennui][stress][fatigue][social][envie]
│ [ Ajouter ]  ☆         │
└──────────────────────┘
```
Préremplie avec la dernière quantité et unité de cet aliment (sinon sa portion par défaut, sinon 100 g). Le repas « collation » propose la case grignotage en premier ; elle est disponible partout.

### 10.3 Code-barres

- Caméra arrière via `getUserMedia` + ZXing (`vendor/`), cadre de visée, lecture EAN-13/EAN-8/UPC ; vibration n'existe pas sur iOS : retour visuel.
- Repli si la caméra est refusée ou indisponible dans l'app installée : saisie du code au clavier, et « Prendre une photo du code » (`<input type=file accept=image/* capture=environment>`, décodée par ZXing).
- Produit trouvé → feuille Quantité. Introuvable → création avec le code-barres retenu (le prochain scan le retrouve).

### 10.4 Phrase libre (`phrase.js`), sans clé

Exemple : « curry pois chiches riz, grosse portion et un skyr ».
- Découpage en segments sur `,`, ` et `, ` + `, ` avec `.
- Par segment : quantité (« 200 g », « 2 », « deux », « un demi », « x2 ») ; taille (petite 0,7, normale 1, grosse/grande 1,3, très grosse 1,6) **[Claude]** ; puis meilleure correspondance parmi `data/plats.json`, mes aliments, Ciqual (même moteur que § 9.4).
- `data/plats.json` : environ 80 plats types **[Claude]** (curry de pois chiches, dahl, chili sin carne, burger végé, pizza margherita, pizza 4 fromages, poké bowl tofu, buddha bowl, falafels, houmous, pad thaï tofu, ramen végé, sushis végé, salade composée, quiche, croque, wrap falafel, lasagnes végé, gnocchis, risotto, tacos végé, bagel, sandwich, croissant, pain au chocolat…), chacun avec synonymes, portion de restaurant en grammes, valeurs pour 100 g et origine des protéines. Valeurs tirées des plats Ciqual quand ils existent, sinon estimées et marquées « estimation » dans le fichier.
- Résultat : liste éditable avant validation (chaque ligne : aliment reconnu, quantité, kcal ; confiance faible → ligne surlignée avec 3 autres choix). Rien n'est ajouté sans « Valider ».
- **« Demander à Claude »** (toujours visible) : copie dans le presse-papiers une demande prête à coller dans l'app Claude (phrase + consigne de répondre par un bloc JSON au format `{ "aliments": [{ "nom", "g", "kcal", "prot", "gluc", "lip", "fib", "origineProt" }] }`) ; un champ « Coller la réponse » extrait le premier bloc JSON valide et remplit la même liste éditable.

### 10.5 Avec une clé API (`ia.js`)

- SDK officiel `@anthropic-ai/sdk` embarqué dans `vendor/` (fichier ESM produit par `tools/vendor.mjs`), client créé avec `dangerouslyAllowBrowser: true` et la clé de l'appareil.
- Modèle `claude-opus-5-5`, `output_config: { effort: 'low', format: { type: 'json_schema', schema } }` (même schéma que § 10.4), `max_tokens` 16 000 ; repli serveur activé (`fallbacks: 'default'` avec l'en-tête bêta `server-side-fallback-2026-07-01`) ; `stop_reason` vérifié avant lecture (`refusal` → message clair et repli sur la saisie sans IA).
- Phrase : envoyée directement, même liste éditable en retour. Photo : `<input type=file accept=image/* capture=environment>`, image réduite à 1 568 px de côté maximum, JPEG, envoyée en base64 avec la consigne d'estimer chaque élément visible.
- Le contexte envoyé contient la phrase ou la photo, et rien d'autre (ni poids, ni historique) **[Claude]**.
- Erreurs (clé invalide, réseau, quota) : message en français, la saisie sans IA reste disponible.

### 10.6 Ajout rapide

kcal (obligatoire) et macros facultatives, avec un nom (« Resto midi »). Utile quand on connaît le total.

### 10.7 Recettes et repas enregistrés

- Recette : nom, ingrédients (même recherche), nombre de parts, poids cuit facultatif. Devient un aliment avec portion « 1 part ». Pensé pour le batch cooking : on cuisine une fois, on ajoute « 1 part » toute la semaine.
- Repas enregistré : depuis le journal, « Enregistrer ce repas » ; un toucher l'ajoute en entier (chaque ligne ajustable ensuite).
- Journal : « Copier vers aujourd'hui » sur un repas d'un autre jour ; « Copier hier » sur un repas vide.

## 11. Grignotage et suggestions

**Grignotage** (`grignotage.js`) : sur 7 / 30 jours : nombre, kcal et part des apports, répartition par heure (créneaux de 2 h), par raison, aliments les plus fréquents, comparaison semaine précédente. Affiché dans Tendances et résumé dans le bilan hebdomadaire. Pas de jugement dans les textes : des constats (« 4 grignotages cette semaine, surtout entre 16 h et 18 h, raison la plus fréquente : faim »).

**Restant bien visible** : chiffre principal de l'accueil, rappelé en haut de la feuille Ajouter et dans la feuille Quantité (« Restant après »).

**Suggestions** (`suggestions.js`, sans IA) : quand il reste au moins 20 g de protéines à couvrir, l'accueil propose jusqu'à 3 combinaisons de 1 à 2 aliments habituels (30 derniers jours, quantités habituelles) qui couvrent le mieux les protéines restantes sans dépasser les kcal restantes + 10 %. Score : protéines couvertes, puis kcal restantes les plus proches de zéro, puis fréquence d'usage. Un toucher ajoute la combinaison au repas courant.
```
Il te manque 40 g P et 400 kcal
  Skyr 250 g + 1 dose whey   45 g P · 330 kcal  [+]
```

## 12. Écrans

Barre d'onglets en bas : **Accueil · Journal · ( + ) · Tendances · Réglages**. Le + central ouvre la feuille Ajouter depuis n'importe où. Thème **sombre** uniquement. Gros chiffres lisibles, cibles tactiles ≥ 44 px, respect des zones sûres de l'iPhone.

**Accueil** (maquette retenue de l'interview) : tendance de poids et pente avec mini-graphique 30 jours, dépense estimée ; restant du jour (kcal en grand, P/G/L/F avec barres) ; suggestion éventuelle ; journal du jour par repas ; séances du jour en une ligne (« Foot 90 min · 720 kcal actives, pour info ») ; bandeau du bilan quand il est dû. Toucher un chiffre affiche son explication.

**Journal** : navigation par jour (flèches, balayage, calendrier) ; les 4 repas avec total ; chaque entrée : toucher = modifier, balayer = supprimer (avec annulation) ; statut de la journée ; pesée et tour de taille du jour (saisie manuelle possible) ; total du jour et origine des protéines.

**Tendances** : poids (points bruts + courbe de tendance, 30 / 90 / 365 jours), dépense estimée dans le temps, apports moyens vs cible par semaine, protéines et fibres moyennes, origine des protéines par semaine, tour de taille et % de gras, grignotage. Historique des bilans.

**Bilan** : § 8.3.

**Réglages** : profil ; cibles (avec historique) ; synchronisation (jeton, test, état, dernière réception, envois en attente, « Synchroniser maintenant ») ; IA (clé, test) ; raccourci (dernier envoi reçu, format, guide) ; mes aliments, recettes, repas enregistrés ; données (export, import) ; à propos (version, sources et licences Ciqual CC-BY 4.0 et Open Food Facts ODbL).

**Première ouverture** (une fois, 4 écrans, tout modifiable ensuite) :
1. Installation : si ouvert dans Safari et non installé, explication « Partager → Sur l'écran d'accueil », puis continuer dans l'app installée.
2. Profil : sexe, date de naissance, taille, poids actuel, niveau d'activité.
3. Cibles de départ : kcal, protéines, glucides, lipides, fibres (pré-calculées depuis le profil, modifiables ; Gaëtan saisit les siennes), rythme 0,5 %/semaine.
4. Synchronisation : jeton (ou « plus tard »). Si le dépôt contient déjà des données, elles sont récupérées et les écrans 2-3 sont sautés.

## 13. Hors connexion et installation

- Service worker : met en cache la coquille, `css/`, `js/`, `data/`, `vendor/`, `icons/` à l'installation ; stratégie « cache d'abord, mise à jour en arrière-plan » ; nouvelle version → bandeau « Mise à jour disponible · Recharger » ; numéro de version dans le nom du cache.
- Hors connexion : tout fonctionne sauf Open Food Facts (sauf cache), l'IA et la synchronisation (mise en attente).
- Manifeste : `display: standalone`, `start_url` et `scope` relatifs (`./`), couleurs sombres ; balises `apple-mobile-web-app-*` et `apple-touch-icon`.

## 14. Tests et critères d'acceptation

**Tests unitaires** (`node --test`, sans dépendance) pour tout `js/core/` et pour `js/data/sync.js` et `depot.js` avec un faux GitHub en mémoire (sha, 409, suppression). Écrits avant le code (TDD). Séries de données fictives générées dans les tests (perte linéaire + bruit), jamais de données réelles.

**Tests de bout en bout** (Playwright, Chromium préinstallé, appareil « iPhone 13 ») : réseau Open Food Facts, GitHub et Anthropic interceptés et simulés. Parcours : première ouverture → ajout par recherche → ajout direct d'un habituel → phrase libre → repas enregistré → rechargement hors connexion → synchronisation simulée entre deux contextes de navigateur → intégration d'un envoi du raccourci → bilan accepté.

**Critères d'acceptation** (un test au moins par ligne) :

| Risque d'abandon | Critère |
|---|---|
| Saisie trop lente | Aliment habituel ajouté en 2 gestes depuis la feuille Ajouter (3 depuis l'accueil) ; recherche locale affichée en < 100 ms sur 3 500 aliments ; quantité préremplie avec la dernière utilisée |
| Aliment introuvable | « tofu », « pois chiches cuits », « skyr », « lentilles corail », « seitan », « tempeh », « flocons d'avoine », « beurre de cacahuète » trouvés hors connexion dans les 5 premiers résultats ; création d'aliment possible depuis toute recherche vide |
| Données perdues | Fusion commutative et idempotente ; deux appareils qui modifient le même mois hors connexion → aucune entrée perdue après synchronisation ; suppression propagée ; envoi du raccourci intégré une seule fois ; export → import restitue tout |
| Cibles incomprises | Aucune cible ne change sans un bilan validé ou une modification manuelle ; chaque bilan affiche toutes les étapes du calcul ; la dépense affichée est toujours accompagnée de son explication |

Autres : aucune donnée personnelle ni secret dans le dépôt (vérification par une recherche dans les tests : pas de motif `ghp_`, `github_pat_`, `sk-ant-`, `@`-adresse) ; pas d'erreur dans la console sur le parcours complet ; page utilisable à 375 px de large.

## 15. Risques ouverts (repris de l'interview)

| Risque | Parade prévue |
|---|---|
| Raccourcis ne lit pas les séances dans Santé | Séances facultatives : le reste du raccourci fonctionne ; saisie manuelle d'une séance possible |
| Caméra refusée dans l'app installée | Photo du code-barres ou saisie au clavier (§ 10.3) |
| Phrase sans IA peu fiable | Liste toujours éditable, 3 choix alternatifs, « Demander à Claude » |
| Jeton dans le raccourci, encodage | Guide pas à pas, bouton « Copier un exemple », lecture tolérante, état du dernier envoi visible |
| SDK Anthropic non chargeable sans compilation | `tools/vendor.mjs` le regroupe en un seul fichier ESM avec esbuild ; vérifié dans un test de bout en bout (appel simulé) |

## 16. Décisions de Claude à valider

1. Valeurs figées dans chaque entrée (§ 6.1).
2. Tendance : moyenne exponentielle à 0,1 ; pente sur 14 jours ; pesée à > 3 kg de la tendance « à confirmer » (§ 8.1).
3. Dépense : facteur 1,55 proposé au départ ; fenêtre 21 jours ; journée valide ≥ 1 000 kcal ou confirmée ; mise à jour à moitié ancienne / moitié mesurée ; minimum 14 jours saisis et 8 pesées (§ 8.2).
4. Bilan le lundi ; plancher au métabolisme de base ; plancher lipides 0,6 g/kg ; fibres 30 g (§ 8.3).
5. Pesée la plus matinale retenue ; le manuel l'emporte sur le raccourci (§ 7.1).
6. Horaires des repas devinés ; jour logique jusqu'à 4 h du matin (§ 10.1).
7. Coefficients de taille de portion dans les phrases (§ 10.4) ; listes de ~80 plats et ~80 portions.
8. IA : `claude-opus-5-5` en effort bas, aucune donnée personnelle envoyée (§ 10.5).
9. Bandeau d'expiration du jeton (§ 7).

## 17. Laissé au constructeur

Détails visuels (typographie, couleurs exactes du thème sombre, animations), formulations exactes des textes, choix de structure interne des modules d'interface, contenu précis de `plats.json` et `portions.json` dans le cadre fixé ci-dessus, découpage des commits. Toute décision qui changerait un chiffre affiché ou un comportement décrit ici revient à Gaëtan.
