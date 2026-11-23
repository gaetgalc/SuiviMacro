# SuiviMacro : contexte du projet

Outil personnel de suivi nutritionnel de Gaëtan (GitHub `gaetgalc`), dans l'esprit de MacroFactor : dépense adaptative, coach hebdomadaire, saisie rapide. Pensé pour un régime végétarien à tendance vegan, une base d'aliments française et un usage quotidien sur iPhone (site installé sur l'écran d'accueil).

Site prévu : https://gaetgalc.github.io/SuiviMacro/ (GitHub Pages depuis `main`, à activer par Gaëtan).

## Où en est le projet

- 23/11 : interview de cadrage (`docs/INTERVIEW.md`), cahier des charges (`docs/superpowers/specs/2026-11-23-suivimacro-design.md`) et plan (`docs/superpowers/plans/2026-11-23-suivimacro.md`) validés, puis construction complète.
- Reste côté Gaëtan, dans l'ordre de `docs/GUIDE.md` : activer GitHub Pages, installer l'app sur l'iPhone, créer le jeton, construire le raccourci, (facultatif) la clé API.
- Risques encore à éprouver sur l'iPhone : lecture des séances par Raccourcis, caméra dans l'app installée, écriture du raccourci dans le dépôt.

## Organisation du code

- `js/core/` : calculs purs (tendance, dépense, bilan, recherche, phrase, suggestions, grignotage, fusion, envois du raccourci), testés sous Node.
- `js/data/` : IndexedDB (`db.js`), API GitHub (`depot.js`), synchronisation (`sync.js`), Open Food Facts, Claude, code-barres.
- `js/ui/` : un fichier par écran ; `composants.js` (html échappé, feuilles, bandeaux, graphiques).
- `data/` : Ciqual 2025 (`npm run ciqual`), plats types et portions. `vendor/` : `npm run vendor`.
- Tests : `npm test` (unitaires) et `npm run e2e` (Playwright, iPhone 13, réseau simulé ; heure fixée par `window.__MAINTENANT__`).
- Tout nouveau fichier servi doit être ajouté à la liste de `sw.js` (un test le vérifie).
- Interface : thème Hallmark « Ribbon », colorie sombre two-in-the-morning ; jetons dans `css/tokens.css`.

## Ce que veut l'utilisateur

- Réponses en français, directes, sans préambule, orientées action.
- Ne jamais avoir à saisir deux fois la même chose.
- Comprendre chaque chiffre : toute cible qui change est expliquée.
- Ne jamais perdre de données.

## Contraintes

- Deux dépôts : `gaetgalc/SuiviMacro` (public, le site) et `gaetgalc/SuiviMacro-data` (privé, les données de Gaëtan, écrites par le site et par le raccourci iPhone). Claude ne lit ni n'écrit dans le dépôt de données : les tests simulent l'API GitHub.
- **Dépôt public : ne jamais y écrire de clé, de jeton, d'e-mail ni de donnée personnelle** (poids, mesures, cibles, repas). Les chiffres personnels se saisissent dans l'app.
- Site statique sans compilation, servi par GitHub Pages ; tout tourne dans le navigateur. Bibliothèques embarquées dans `vendor/` (récupérées par npm : jsdelivr est bloqué depuis l'environnement cloud).
- Clé API Anthropic et jeton GitHub : saisis dans le site, stockés sur l'appareil, jamais dans le dépôt. L'abonnement Claude Pro n'inclut pas l'API.
- Claude peut pousser sur ce dépôt mais pas modifier ses réglages (GitHub Pages).
- Environnement cloud `SuiviMacro` : joint Open Food Facts (`world`, `fr`, `search.openfoodfacts.org`), Ciqual (`ciqual.anses.fr`, `zenodo.org`, data.gouv.fr) et les registres de paquets.
- Ce projet est indépendant de Cap 1000 (`gaetgalc/cap-1000`, le coach d'échecs) : ne rien écrire dans ce dépôt-là.

## Skills et plugins Claude Code

Déclarés dans `.claude/settings.json` : `superpowers`, `mattpocock-skills`, `frontend-design`, `hallmark`. Le script d'installation de l'environnement `SuiviMacro` installe les trois qui ne sont pas officiels. S'ils manquent dans la liste des skills : `claude plugin marketplace add obra/superpowers-marketplace`, `mattpocock/skills`, `Nutlope/hallmark`, puis `claude plugin install <nom>@<marketplace>`.

À utiliser par défaut, sans attendre que Gaëtan le demande :

| Situation | Skill |
|---|---|
| Nouvelle fonctionnalité ou changement de comportement | `superpowers:brainstorming` si la demande est floue, puis `superpowers:writing-plans` si plus de quelques fichiers |
| Code testable (calcul de dépense, coach, tendance, synchronisation, recherche) | `superpowers:test-driven-development` (test rouge d'abord) |
| Bug ou comportement inattendu | `superpowers:systematic-debugging` |
| Retouche visuelle, nouvel écran | `frontend-design` et `hallmark` |
| Avant d'annoncer « terminé » ou de fusionner dans `main` | `superpowers:verification-before-completion`, puis `/code-review` et `/simplify` |

Les règles de ce fichier priment sur celles des skills (réponses en français, pas de worktree imposé).

## Publication

Règle reprise de Cap 1000, à confirmer par Gaëtan : une fois les tests passés, fusionner directement dans `main` et pousser, sans pull request.
