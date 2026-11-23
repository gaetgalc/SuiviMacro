# SuiviMacro : mise en route

Cinq étapes, une seule fois. Compte 20 minutes, dont 10 pour le raccourci iPhone.

## 1. Mettre le site en ligne (GitHub Pages)

1. Sur GitHub, ouvre le dépôt `gaetgalc/SuiviMacro`, puis **Settings › Pages**.
2. Dans « Build and deployment », choisis **Source : Deploy from a branch**, branche **`main`**, dossier **`/ (root)`**, puis **Save**.
3. Au bout d'une à deux minutes, le site répond sur <https://gaetgalc.github.io/SuiviMacro/>.

## 2. Installer l'app sur l'iPhone

1. Ouvre l'adresse dans **Safari** (pas un autre navigateur : seul Safari sait installer une app web).
2. Touche **Partager**, puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Ouvre ensuite SuiviMacro **depuis son icône**. Tout se règle là : l'app installée a son propre stockage, séparé de Safari.

## 3. Créer le jeton GitHub (synchronisation et sauvegarde)

Le jeton permet à l'app, et à elle seule, de lire et d'écrire dans ton dépôt de données privé `gaetgalc/SuiviMacro-data`.

1. GitHub › photo de profil › **Settings › Developer settings › Personal access tokens › Fine-grained tokens › Generate new token**.
2. **Token name** : `SuiviMacro`. **Expiration** : la durée la plus longue proposée (note la date).
3. **Repository access** : **Only select repositories** › `SuiviMacro-data`.
4. **Permissions › Repository permissions › Contents** : **Read and write**. Rien d'autre.
5. **Generate token**, puis copie-le (il commence par `github_pat_`). GitHub ne le remontrera plus.
6. Dans l'app : première ouverture › **Synchronisation**, ou plus tard **Réglages › Synchronisation**. Colle le jeton, renseigne la date d'expiration (l'app te prévient 14 jours avant), **Tester et enregistrer**.

Le jeton reste sur l'iPhone. Il n'est jamais écrit dans un dépôt. Sur un autre appareil, recolle le même jeton : tes données arrivent toutes seules.

> Chaque enregistrement est un commit du dépôt de données : tout l'historique est récupérable depuis GitHub. **Réglages › Données › Exporter** fait en plus une copie complète en un fichier.

## 4. Le raccourci du matin (poids, % de gras, séances)

Withings écrit ton poids et ton % de gras dans l'app Santé ; COROS et Strava y écrivent tes séances. Le raccourci lit Santé chaque matin et dépose un petit fichier dans le dossier `inbox/` du dépôt de données. L'app l'intègre à sa prochaine ouverture.

### 4.1 Créer le raccourci

App **Raccourcis** › **+** › nomme-le `SuiviMacro`. Ajoute les actions dans cet ordre :

1. **Rechercher des échantillons de santé** : type **Poids**, trier par **Date de début**, le plus récent en premier, limite **1**.
2. **Rechercher des échantillons de santé** : type **Masse grasse**, mêmes réglages.
3. **Rechercher des échantillons de santé** : type **Entraînements**, filtre **Date de début est après** *hier à 0 h* (facultatif : si l'action ne propose pas les entraînements sur ton iPhone, supprime-la et la ligne `seances` plus bas).
4. **Date actuelle**, puis **Formater la date** : format **ISO 8601**, avec l'heure. Renomme le résultat `Maintenant`.
5. **Dictionnaire** avec ces clés (texte, sauf mention) :
   - `version` : nombre `1`
   - `envoye` : `Maintenant`
   - `poids` : liste contenant un dictionnaire `date` = *Date de début du Poids* (formatée ISO 8601), `kg` = *Valeur du Poids*
   - `gras` : liste contenant un dictionnaire `date` = *Date de début de la Masse grasse* (ISO 8601), `pct` = *Valeur de la Masse grasse*
   - `seances` : pour chaque entraînement, un dictionnaire `debut`, `fin` (ISO 8601), `type` (*Type d'entraînement*), `dureeMin` (*Durée* en minutes), `kcal` (*Énergie active*)
6. **Encoder en Base64** le dictionnaire (option : **Aucune** coupure de ligne).
7. **Texte** : `inbox/` suivi de `Maintenant` (remplace les deux-points par des tirets si l'app le demande) et `.json`. Renomme-le `Chemin`.
8. **Obtenir le contenu de l'URL** :
   - URL : `https://api.github.com/repos/gaetgalc/SuiviMacro-data/contents/` puis `Chemin`
   - Méthode : **PUT**
   - En-têtes : `Authorization` = `Bearer ` suivi de ton jeton ; `Accept` = `application/vnd.github+json`
   - Corps de la requête : **JSON**, clés `message` = `inbox` et `content` = *le texte Base64*

L'app accepte les valeurs telles que Santé les donne (« 80,2 kg », « 18,4 % », virgule française). **Réglages › Raccourci** affiche le format attendu, un bouton **Copier un exemple**, et le résultat du dernier envoi (valeurs lues, valeurs ignorées).

### 4.2 L'automatiser

**Raccourcis › Automatisation › + › Heure de la journée** : un horaire après ta pesée (par exemple 8 h), **Quotidiennement**, **Exécuter immédiatement**, sans notification. Choisis le raccourci `SuiviMacro`.

Règles appliquées à l'arrivée :
- plusieurs pesées un même jour : la plus matinale est retenue ;
- une pesée saisie à la main dans l'app n'est jamais remplacée par le raccourci ;
- un même envoi reçu deux fois ne crée pas de doublon ; le fichier `inbox/` est supprimé une fois intégré.

## 5. Claude dans l'app (facultatif)

Sans clé, la saisie en phrase fonctionne avec les plats types et la base d'aliments ; le bouton **Demander à Claude** copie une demande à coller dans l'app Claude, et tu colles sa réponse dans SuiviMacro.

Avec une clé API, la phrase part directement à Claude et la **photo** d'un repas devient possible :
1. <https://console.anthropic.com> › **API Keys › Create Key**. L'API est facturée à part de l'abonnement Claude Pro.
2. Dans l'app : **Réglages › Claude**, colle la clé, **Tester et enregistrer**.

Seule la phrase ou la photo est envoyée à Claude : ni poids, ni cibles, ni historique.

## En cas de souci

| Symptôme | Que faire |
|---|---|
| Pastille « Jeton refusé » | Le jeton a expiré ou n'a plus accès au dépôt : recrées-en un (étape 3) et colle-le dans Réglages. |
| Pastille « Hors ligne, n en attente » | Rien à faire : les modifications partent au retour du réseau. |
| La caméra ne s'ouvre pas pour le code-barres | Réglages de l'iPhone › Safari › Caméra › Autoriser ; sinon, saisis le code ou prends-le en photo. |
| Dernier envoi du raccourci « valeurs ignorées » | Vérifie le format des dates (ISO 8601) dans l'action Formater la date. |
| Mise à jour disponible | Touche **Recharger** sur le bandeau. |
