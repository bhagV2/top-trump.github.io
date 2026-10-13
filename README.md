# Top Trump

Jeu de cartes statique publié sur GitHub Pages. Le site fonctionne sans serveur
ni API PHP : les comptes, les collections et l’historique restent dans le
navigateur utilisé. Les duels se jouent contre l’ordinateur ; à chaque partie,
il reçoit cinq cartes tirées au hasard. Les données ne
sont pas partagées entre joueurs ou appareils et sont supprimées si les données
du site sont effacées dans le navigateur. Si tu gagnes un duel, tu peux choisir
une carte parmi les cinq cartes tirées par l’ordinateur pour l’ajouter à ta collection.

## Développement local

Ouvre `docs/index.html` dans un navigateur ou lance un serveur statique depuis
la racine du dépôt :

```sh
python -m http.server 8000 --directory docs
```

Puis visite <http://localhost:8000>.

## Publication

Le site publié est directement dans `docs/`. Le workflow
`.github/workflows/deploy-pages.yml` téléverse ce dossier sur chaque push vers
`main`, ainsi qu’à la demande depuis l’onglet **Actions**.

Dans **Settings → Pages**, choisis **GitHub Actions** comme source de
déploiement. Les fichiers du site sont autonomes dans `docs/` ; aucun runtime
PHP ni variable `TOPTRUMP_API_URL` n’est nécessaire.
