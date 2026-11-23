# SuiviMacro : contexte du projet

Outil personnel de suivi nutritionnel de Gaëtan (GitHub `gaetgalc`), dans l'esprit de MacroFactor : dépense adaptative, coach hebdomadaire, saisie rapide. Pensé pour un régime végétarien à tendance vegan, une base d'aliments française et un usage quotidien sur iPhone (site installé sur l'écran d'accueil).

Site prévu : https://gaetgalc.github.io/SuiviMacro/ (GitHub Pages depuis `main`, à activer par Gaëtan).

## Où en est le projet

- 23/11 : interview de cadrage terminée, compte rendu dans `docs/INTERVIEW.md`. **Le lire en entier avant toute décision de conception.**
- Étape suivante : cahier des charges `docs/superpowers/specs/2026-11-23-suivimacro-design.md`, puis validation par Gaëtan, puis plan (`superpowers:writing-plans`) dans `docs/superpowers/plans/`, puis construction.
- Objectif fixé par Gaëtan : un site prêt à 99 % à la livraison, peu de retouches. L'enjeu est l'équilibre entre facilité d'utilisation et exhaustivité.

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
