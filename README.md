# Top Trump

## Lancement

Le projet fonctionne avec PHP et ne nécessite pas de base de données. Depuis le
répertoire du projet, démarre un serveur PHP puis ouvre `frontend/` :

```sh
php -S localhost:8000 server-router.php
```

Ouvre ensuite <http://localhost:8000/frontend/>. Le serveur PHP doit pouvoir
écrire dans `backend/data/`, où il crée automatiquement `store.json` au premier
usage. Le routeur de développement et les règles Apache de
`backend/data/.htaccess` interdisent la lecture directe du fichier de données.
Sur un autre serveur, configure la même interdiction.

Les comptes, mots de passe hachés, collections, packs, duels et journal
d’activité sont conservés dans ce fichier JSON. Les requêtes d’écriture sont
verrouillées pour éviter les modifications concurrentes du fichier.

## Organisation

- `frontend/`: pages PHP, éléments partagés, CSS, JavaScript et images des cartes.
- `backend/api/index.php`: routeur HTTP qui dirige chaque route/action vers son
  gestionnaire dédié.
- `backend/api/requests.php`: gestionnaires de l’authentification, des
  collections, des packs et des statuts.
- `backend/api/game_requests.php`: gestionnaires du matchmaking, des manches
  et de l’abandon d’un duel.
- `backend/functions/json_store.php`: stockage JSON et fonctions de données.
- `backend/generation/cards.json`: catalogue statique utilisé par le jeu.
- `backend/data/store.json`: données créées automatiquement à l’exécution.

Les joueurs préparent un duel avec cinq cartes différentes de leur collection.
Le premier à trois points gagne ; une égalité ne retire pas les cartes des mains.
Les cartes des manches gagnées et les cartes restantes du joueur qui abandonne
sont ajoutées à la collection du vainqueur.

Le fichier `backend/data/store.json` n’est pas compatible avec l’ancienne base
MariaDB et les données de celle-ci ne sont pas importées automatiquement.

## Publication sur GitHub Pages

GitHub Pages héberge seulement le site statique ; l’API PHP et son fichier JSON
doivent rester sur un hébergement compatible avec PHP. La structure publiée est
générée dans `docs/` :

```text
docs/
├── index.html
├── cards.html
├── collection.html
├── deck.html
├── game.html
├── activity.html
├── assets/
├── css/
├── js/
│   └── api-config.js
└── .nojekyll

backend/                 # à héberger séparément avec PHP
├── api/
├── config/
├── functions/
├── generation/
└── data/                # données JSON, à protéger contre l’accès web
```

1. Héberge `backend/` sur un serveur PHP et configure sa variable
   `TOPTRUMP_ALLOWED_ORIGIN` avec l’origine exacte de GitHub Pages, par exemple
   `https://utilisateur.github.io`. En cas d’utilisation d’un domaine GitHub
   Pages personnalisé, indique son origine exacte à la place.
2. Dans `backend`, configure `TOPTRUMP_COOKIE_SAMESITE=None` pour une API sur un
   autre site. Les cookies `None` exigent HTTPS ; les navigateurs qui bloquent
   les cookies tiers peuvent nécessiter un domaine personnalisé commun au site
   et à l’API.
3. Remplace l’URL d’exemple dans `docs/js/api-config.js` par l’adresse HTTPS
   réelle de `backend/api/index.php`.
4. Génère le site statique :

   ```sh
   php scripts/build-github-pages.php
   ```

5. Publie le dossier `docs/` sur GitHub, puis dans **Settings → Pages**, choisis
   la branche principale et le dossier `/docs`.

Le générateur rend les pages PHP actuelles en HTML et copie les ressources
statiques. Il conserve `docs/js/api-config.js` afin que l’URL de l’API ne soit
pas écrasée lors d’une nouvelle génération.
