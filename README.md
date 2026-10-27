# Top Trump

Jeu de cartes statique publié sur GitHub Pages. Le site fonctionne sans serveur
ni API PHP : les comptes, les collections et l’historique restent dans le
navigateur utilisé. Les duels se jouent contre l’ordinateur ; à chaque partie,
il reçoit cinq cartes tirées au hasard. Les données ne
sont pas partagées entre joueurs ou appareils et sont supprimées si les données
du site sont effacées dans le navigateur. Si tu gagnes un duel, tu peux choisir
une seule carte parmi les cinq cartes tirées par l’ordinateur pour l’ajouter à
ta collection. À la création du compte, un guide avec des repères visuels
accompagne l’ouverture du premier pack, la visite de la collection et du
catalogue, puis la préparation du premier duel en guidant d’abord la sélection
des cinq cartes de la main et ensuite le lancement du match. Le tutoriel du duel
présente ensuite le score, le choix des caractéristiques et le vol d’une carte
par le gagnant. Le tableau de bord suit une mission quotidienne et trois objectifs
persistants, qui récompensent chacun d’un pack bonus, ainsi que des badges liés
à la collection. Les objectifs comptent les victoires, les manches remportées
et les cartes différentes découvertes. Les packs bonus ignorent le délai
habituel de 20 minutes ; la progression est enregistrée dans le navigateur.

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
