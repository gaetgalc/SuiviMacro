# SuiviMacro : interview de cadrage (23/11/2026)

Compte rendu de l'interview menée avant la conception (28 questions). C'est la source du cahier des charges : toute décision de conception doit pouvoir s'y rattacher. Les choix marqués **[Claude]** ont été proposés par Claude sans objection de Gaëtan ; ils restent à confirmer à la relecture du cahier des charges.

> Dépôt public : les chiffres personnels (poids, taille, âge, cibles caloriques) ne sont pas écrits ici. Ils se saisissent dans l'app, à la première ouverture.

## Le produit en une phrase

Un outil personnel de suivi nutritionnel dans l'esprit de MacroFactor (dépense adaptative, coach hebdomadaire), gratuit, pensé pour un régime **végétarien à tendance vegan** et une base d'aliments **française**, utilisé au quotidien sur **iPhone, installé sur l'écran d'accueil**.

**L'enjeu, dans les mots de Gaëtan :** « trouver la balance entre facilité d'utilisation et exhaustivité des fonctions ». Il abandonnera l'app si : la saisie est trop lente, un aliment est introuvable, des données sont perdues, ou les cibles changent sans qu'il comprenne pourquoi (les quatre ont été cochés).

## Pourquoi ne pas utiliser MacroFactor

Toutes les raisons proposées ont été retenues, plus une ajoutée par Gaëtan :
- adapter les aliments à un régime végé à tendance vegan (ajout de Gaëtan) ;
- éviter l'abonnement ;
- coller à son profil (protéines, lutte contre le grignotage) ;
- meilleure base française (produits de supermarché, aliments bruts) ;
- brancher ses outils (IA Claude, données de santé, séances).

Gaëtan connaît MacroFactor **de réputation**, sans l'avoir utilisé : aucun historique à importer, pas d'habitudes d'interface à reproduire.

## Réponses, thème par thème

### Appareil et données

| Question | Réponse | Conséquence |
|---|---|---|
| Appareil principal | iPhone, site installé sur l'écran d'accueil | Application web installable (manifeste, plein écran), pensée d'abord pour une largeur de téléphone |
| Données sur plusieurs appareils | Synchronisation via un **dépôt GitHub privé** | Dépôt `gaetgalc/SuiviMacro-data` (privé, créé avec un README) ; jeton GitHub à portée limitée à ce seul dépôt, stocké sur l'appareil |
| Dépôt du site | Public, GitHub Pages | `gaetgalc/SuiviMacro` ; aucune donnée personnelle dans le code |
| Nom | SuiviMacro | |

### Saisie des aliments

| Question | Réponse | Conséquence |
|---|---|---|
| Façons d'ajouter un aliment | Les quatre : code-barres, recherche d'aliments bruts, phrase libre via IA, photo via IA | Open Food Facts (code-barres et recherche de produits), table Ciqual de l'ANSES embarquée (aliments bruts, hors connexion), IA en option |
| Clé API Anthropic | **Prévoir, activer plus tard** | Le site fonctionne entièrement sans clé ; les fonctions IA apparaissent quand une clé est saisie |
| Repas | Très répétitifs, batch cooking, souvent dehors | Favoris et repas enregistrés en un geste ; recettes multi-portions ; estimation rapide hors de chez soi |
| Quantités | « Je peux peser mais je n'arriverai pas à garder le rythme. Je veux que ce que je rentre soit enregistré pour ne pas avoir à le mettre deux fois. » | Grammes **et** portions (pièce, bol, cuillère) ; chaque aliment retient la dernière quantité ; rien ne se ressaisit |
| Au restaurant, sans IA | « J'ai envie de dire ce que j'ai mangé et tu estimes. » | Saisie en phrase même sans clé (voir décisions [Claude]) |
| Organisation de la journée | « Ce qui te paraît cohérent » | Voir décisions [Claude] |
| Moment de la saisie | Juste après avoir mangé | Ouverture → ajout en très peu de gestes ; repas deviné selon l'heure |

### Poids, mesures, sport, coach

| Question | Réponse | Conséquence |
|---|---|---|
| Pesée | Balance connectée **Withings**, pesée possible tous les matins | Withings écrit poids et % de gras dans l'app Santé de l'iPhone |
| Transfert vers le site | **Raccourci iPhone** (Apple Raccourcis) | Automatisation chaque matin : lit Santé et transmet au site, sans saisie |
| Autres mesures | Tour de taille, % de masse grasse | % de gras via Withings/Santé ; tour de taille saisi à la main (hebdomadaire) |
| Séances (foot, salle, gravel) | **Affichées pour info**, sans changer le budget | Aucun ajout de calories d'activité au budget |
| Récupération des séances | Même raccourci iPhone | COROS et Strava écrivent dans Santé ; le raccourci transmet aussi les séances de la veille |
| Évolution des cibles | **Proposition hebdomadaire à valider** (recalcul de la dépense, nouvelles cibles avec explication, accepter ou modifier) | Écran de bilan hebdomadaire ; toute variation de cible est expliquée |
| Rythme de perte | **0,5 % du poids par semaine** | Le coach dimensionne le déficit sur ce rythme |
| Répartition des macros | **Protéines fixes, le reste suit** (glucides et lipides suivent les calories dans les proportions des cibles de départ) | |
| Budget selon les jours | « Tu me recommandes quoi ? Je veux aller au plus simple sinon je ne suivrai pas » → **identique tous les jours** (recommandation de Claude, acceptée) | Une seule cible par jour |

### Suivi, grignotage, accueil

| Question | Réponse | Conséquence |
|---|---|---|
| Suivi au-delà des macros | **Fibres**, **qualité des protéines** (part légumineuses / soja / céréales / laitiers / oléagineux) | Pas de micronutriments du régime végétal (B12, fer…) ni d'eau/alcool demandés |
| Contre le grignotage | **Restant bien visible** ; **comprendre mes grignotages** (marquer un ajout comme grignotage, heure, raison : faim, ennui, stress… ; voir les tendances) | Ni collation planifiée ni planification du matin demandées |
| Suggestions | Oui, **depuis les aliments habituels** (« il te manque 40 g de protéines et 400 kcal : skyr 250 g + 1 dose de whey ») | Fonctionne sans IA |
| Premier écran | **Tendance d'abord** : poids lissé et sa pente, dépense estimée, puis restant du jour, puis journal | Maquette retenue ci-dessous |
| Style | **Sombre** | |

Maquette d'accueil choisie :

```
┌──────────────────────┐
│ Tendance  95,3 kg ↘    │
│ ╲_╲__╲___╲____        │
│ -0,48 kg / semaine     │
│ Dépense  2 890 kcal/j  │
│──────────────────────│
│ 1 240 kcal restantes   │
│ P 92/150 · G 120/230   │
│──────────────────────│
│ Petit-déj     520 kcal │
│ Déjeuner      640 kcal │
│                      │
│      [ + Ajouter ]     │
└──────────────────────┘
```
(chiffres fictifs)

## Décisions proposées par Claude [Claude]

1. **Journée en 4 repas** : petit-déj, déjeuner, collation, dîner ; le repas est deviné selon l'heure, modifiable.
2. **Saisie en phrase sans clé API** : le site reconnaît des plats types (curry de pois chiches, burger végé, pizza, poké bowl tofu, falafels…) et des aliments de la base dans une phrase (« curry pois chiches riz, grosse portion ») ; pour le reste, un bouton « Demander à Claude » copie une demande à coller dans l'appli Claude (abonnement Pro), puis Gaëtan colle la réponse. Avec une clé API, la même phrase (ou une photo) part directement à Claude.
3. **Le raccourci écrit directement dans le dépôt de données**, par l'API GitHub, et non en ouvrant une adresse du site : sur iPhone, une app installée sur l'écran d'accueil ne partage pas son stockage avec Safari, une adresse ouverte par le raccourci écrirait dans le mauvais stockage. Piste : un fichier nouveau par envoi (une « boîte de réception »), ce qui évite au raccourci de lire avant d'écrire.
4. **Calcul de la dépense** : estimation de départ par la formule de Mifflin-St Jeor et un facteur d'activité ; ensuite apports moyens − variation de la tendance de poids × ≈ 7 700 kcal/kg, lissé dans le temps ; un jour non saisi est exclu, jamais compté comme zéro.
5. **Pas de notifications** : sur iPhone, un site sans serveur ne peut pas programmer de rappel.
6. **Construction** : site statique sans compilation (HTML, JavaScript en modules, CSS), comme Cap 1000 ; stockage local (IndexedDB) et synchronisation par le dépôt privé. Écartés : React/Vite (compilation sans bénéfice pour Gaëtan), base en ligne type Supabase (refusée par Gaëtan).

## Reconnaissance technique du 23/11

- **Open Food Facts** joignable depuis l'environnement cloud (après autorisation des hôtes) :
  - fiche produit : `GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=…` → `{ code, product: { product_name, brands (chaîne), quantity, serving_size, serving_quantity, categories_tags, nutriments } }` ; valeurs pour 100 g dans `nutriments["energy-kcal_100g"]`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `fiber_100g` ;
  - recherche : `GET https://search.openfoodfacts.org/search?q=…&langs=fr&page_size=…&fields=…` → `{ hits: [{ code, product_name, brands (tableau), nutriments }], page, page_size, page_count }` ; « tofu nature » renvoie bien des produits français ;
  - limites de débit de l'API publique à respecter (recherche à la frappe à temporiser, mise en cache des fiches).
- **Ciqual** : le site `ciqual.anses.fr` était en maintenance le 23/11 (réponse 503). data.gouv.fr ne référence que la table 2020 (fichiers hébergés sur `ciqual.anses.fr`). La table la plus récente est publiée par l'ANSES sur **Zenodo** (enregistrement concept `17550132`, fichiers XML `alim_*`, `alim_grp_*`, `compo_*`, `const_*`, `sources_*` ; source repérée via le paquet `ciqual-mcp`). Licence à vérifier sur la fiche Zenodo avant d'embarquer la table.
- **Code-barres** : Safari n'a pas de lecteur natif (`BarcodeDetector`) ; il faut une bibliothèque (ZXing, disponible sur npm) embarquée dans `vendor/`.
- **Réseau de l'environnement cloud** : jsdelivr est bloqué, le registre npm est ouvert : les bibliothèques se récupèrent par npm et s'embarquent dans le dépôt.

## Risques ouverts

- Lecture des séances par Raccourcis dans Santé : à vérifier sur l'iPhone de Gaëtan.
- Accès à la caméra pour le code-barres dans une app installée sur l'écran d'accueil : à vérifier sur l'iPhone.
- Qualité de la saisie en phrase sans IA : dépend de la richesse de la table de plats types.
- Écriture du raccourci dans le dépôt privé (jeton dans le raccourci, encodage du fichier) : à éprouver avec Gaëtan.

## Étapes suivantes

1. Cahier des charges complet : `docs/superpowers/specs/2026-11-23-suivimacro-design.md` (relu par un « constructeur » avant remise).
2. Relecture et validation par Gaëtan.
3. Plan de construction (`superpowers:writing-plans`), dans `docs/superpowers/plans/`.
4. Construction, tests, mise en ligne ; guide pas à pas pour le jeton GitHub, le raccourci iPhone et l'activation de GitHub Pages.
