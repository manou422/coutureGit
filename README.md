# Album couture — présentation de l'architecture

Un album de créations couture, privé : on s'y connecte, on parcourt les
créations, on ouvre chacune en détail. Manuela y ajoute et modifie les
créations ; les autres membres ne font que regarder.

Ce document décrit **comment le projet est fait**. Pour le mettre en ligne,
voir [DEPLOIEMENT.md](DEPLOIEMENT.md). Pour les détails d'une fonction
précise, les fichiers eux-mêmes sont commentés.

---

## En un coup d'œil

```
   NAVIGATEUR                          SERVEUR                    BASE
┌────────────────┐              ┌──────────────────┐        ┌────────────┐
│  Site Vue 3    │  requêtes    │  Express         │  SQL   │   MySQL    │
│  (dossier      │─── /api/ ───▶│  (server.js)     │───────▶│  5 tables  │
│   album/)      │◀─── JSON ────│                  │◀───────│            │
│                │              │  + sert le site  │        │            │
│  routeur       │              │    compilé en    │        │ les photos │
│  stores        │              │    production    │        │ sont dans  │
│  composants    │              │                  │        │ la base    │
└────────────────┘              └──────────────────┘        └────────────┘
```

Deux moitiés, et une règle qui explique presque tout le code :

> **Le navigateur ne touche jamais à la base de données.** Il passe toujours
> par le serveur, qui seul décide qui a le droit de faire quoi.

C'est pour cette raison que cacher un bouton dans le site ne protège rien :
la vraie barrière est du côté serveur, et elle y est systématiquement posée.

---

## Les deux moitiés

### Le serveur — [server.js](server.js)

Un seul fichier, environ 800 lignes. Il fait trois choses :

1. **il parle à MySQL** — création des tables au démarrage, puis lectures
   et écritures ;
2. **il expose une API** — des adresses en `/api/...` qui reçoivent et
   renvoient du JSON ;
3. **en production, il sert aussi le site** — les fichiers compilés dans
   `album/dist/`, et `index.html` pour toute autre adresse.

Ce troisième point mérite une explication : le site est une « application à
page unique ». `/galerie` n'existe pas comme fichier sur le disque ; c'est le
routeur Vue qui, une fois la page chargée, affiche le bon écran. Sans la
dernière route de `server.js`, recharger `/galerie` donnerait une erreur 404.

### Le site — [album/](album/)

Vue 3 avec la syntaxe `<script setup>`, et `vue-router` pour la navigation.
Pas de Vuex ni de Pinia : l'état partagé tient dans deux petits fichiers du
dossier `stores/`, qui exportent simplement des `ref`. Pas de framework CSS
non plus — chaque composant porte son propre `<style scoped>`.

Un fichier `.vue` tient toujours en trois blocs : `template` (ce qui
s'affiche), `script` (le code qui le pilote), `style` (l'apparence).

---

## Carte des fichiers

```
.
├── server.js              l'API + le service du site en production
├── dev.js                 lance les deux moitiés d'un coup (npm run dev)
├── seed.js                remplissage d'exemple, à lancer une fois
├── .env.example           le modèle de configuration à recopier en .env
├── DEPLOIEMENT.md         la mise en ligne, pas à pas
│
└── album/                 le site
    ├── index.html         page unique, presque vide : Vue la remplit
    ├── vite.config.js     dont le proxy /api → port 3000 en développement
    └── src/
        ├── main.js        plan du site : quelle adresse → quel écran
        ├── App.vue        le cadre commun (menu + bouton retour + écran)
        │
        ├── stores/        l'état partagé entre écrans
        │   ├── auth.js    session, appels API, catégories, images
        │   └── photos.js  la liste des créations
        │
        ├── utils/
        │   └── image.js   réduction des photos avant envoi
        │
        ├── components/    morceaux réutilisés
        │   ├── NavBar.vue        le menu bleu de gauche
        │   ├── PhotoCard.vue     une vignette de la galerie
        │   ├── BoutonRetour.vue  la flèche en haut à gauche
        │   └── IconeOeil.vue     l'œil des champs « mot de passe »
        │
        └── views/         un fichier par écran
            ├── HomeView.vue           accueil
            ├── GalerieView.vue        la grille des créations
            ├── DescriptionView.vue    le détail d'une création
            ├── AjouterView.vue        ajouter          (admin)
            ├── ModifierView.vue       modifier         (admin)
            ├── CategoriesView.vue     gérer les catégories
            ├── StatistiquesView.vue   fréquentation    (admin)
            ├── CompteView.vue         mon compte
            ├── LoginView.vue          connexion
            ├── InscriptionView.vue    création de compte
            ├── MotDePasseOublieView.vue   demande de réinitialisation
            └── ReinitialiserView.vue      choix du nouveau mot de passe
```

---

## Le parcours d'une requête

Exemple concret : **afficher la galerie**. Il vaut la peine de le suivre une
fois, car toutes les autres actions suivent le même chemin.

```
1. clic sur « Galerie »          NavBar.vue
        │
2. le routeur change d'écran     main.js  → beforeEach vérifie la session
        │
3. l'écran demande la liste      GalerieView.vue → chargerPhotos()
        │
4. le store appelle l'API        stores/photos.js → api('/api/photos')
        │                        api() ajoute le jeton dans l'en-tête
        │
5. le serveur vérifie, puis lit  server.js → authentifier → SELECT
        │
6. JSON de retour, sans images   [{ id, titre, description, nbPhotos }, …]
        │
7. la grille s'affiche           une PhotoCard par création
        │
8. chaque carte va chercher      PhotoCard.vue → urlImage(id)
   son image de son côté         → /api/photos/:id/image
```

Le point important est l'étape 6 : **la liste ne contient pas les images**.
Quelques centaines d'octets au lieu de plusieurs mégaoctets, donc une galerie
qui s'affiche tout de suite, puis des vignettes qui apparaissent une à une.

---

## Les images : le point le plus particulier du projet

Les photos sont stockées **dans la base**, en base64, et non comme fichiers.
C'est ce qui rend leur traitement inhabituel, en trois endroits.

**À l'envoi** — une photo de téléphone fait 4 à 6 Mo pour 4 000 px de large,
que le site n'utilise jamais. [utils/image.js](album/src/utils/image.js) la
redessine à 1 600 px dans le navigateur **avant** l'envoi : le serveur ne
reçoit jamais l'original.

**À l'affichage** — une balise `<img src="...">` ne sait pas joindre un
en-tête d'authentification. On télécharge donc l'image avec `fetch` (qui,
lui, passe par `api()` et son jeton), puis on fabrique une adresse locale
temporaire — un *blob* — que `<img>` sait afficher. D'où les `urlImage()` /
`urlPhoto()` de `stores/auth.js`, et les `URL.revokeObjectURL()` au moment de
quitter une page : sans eux, les images s'accumuleraient en mémoire.

**En base** — une création peut porter jusqu'à 12 photos, rangées dans la
table `photos` avec un champ `ordre`. La première (ordre 0) sert de
couverture en galerie.

**À la modification** — le formulaire renvoie la liste complète des photos
dans l'ordre voulu, en désignant celles déjà stockées par `conserver:<id>`
au lieu de les retéléverser. Le serveur aligne alors la base sur cette
liste. C'est le « protocole `conserver:` », documenté dans `server.js` et
dans `ModifierView.vue`.

> Conséquence à garder en tête : la base grossit vite. Voir la section
> « espace disque » de [DEPLOIEMENT.md](DEPLOIEMENT.md).

---

## Qui a le droit de quoi

**Deux rôles.** `admin` (Manuela) peut tout ; `PA`, le membre invité créé par
l'inscription, ne peut que regarder. Le rôle n'est jamais lu depuis le
client : il est imposé par le serveur à l'inscription, et relu en base à
chaque requête.

**La session** est un jeton signé en HMAC-SHA256, valable 7 jours, rangé dans
le `localStorage` du navigateur et renvoyé dans l'en-tête `Authorization`.
Son contenu (`id` + date d'expiration) est lisible par tout le monde — ce
n'est pas un secret ; c'est la signature, impossible à recalculer sans
`SESSION_SECRET`, qui empêche de le falsifier.

**Trois gardes** se posent devant les routes, dans cet ordre :

| Garde | Rôle |
|---|---|
| `authentifier` | jeton valide exigé ; relit le compte en base |
| `soiMeme` | on n'agit que sur son propre compte |
| `adminSeulement` | réservé à l'administratrice |

Côté site, `main.js` fait la même vérification avant d'afficher un écran,
mais **uniquement par confort** : cela évite d'afficher une page vide. La
sécurité, elle, est entièrement du côté serveur.

### Les routes de l'API

| Route | Qui | Ce qu'elle fait |
|---|---|---|
| `POST /api/login` | tous | connexion, renvoie le jeton |
| `POST /api/inscription` | tous | création d'un compte `PA` |
| `GET /api/inscription/config` | tous | un code d'invitation est-il exigé ? |
| `POST /api/mot-de-passe-oublie` | tous | envoie le lien de réinitialisation |
| `POST /api/reinitialiser` | tous | applique le nouveau mot de passe |
| `GET` `PUT` `DELETE /api/utilisateurs/:id` | soi-même | fiche, modification, suppression |
| `GET /api/photos` | connecté | la liste, sans les images |
| `GET /api/photos/:id` | connecté | une création et les id de ses photos |
| `GET /api/photos/:id/image` | connecté | l'image de couverture |
| `GET /api/images/:imageId` | connecté | une photo précise |
| `POST` `PUT` `DELETE /api/photos` | admin | ajouter, modifier, supprimer |
| `GET /api/categories` | connecté | la liste, avec les compteurs |
| `POST` `PUT` `DELETE /api/categories` | admin | créer, renommer, supprimer |
| `PATCH /api/categories/:id/visibilite` | admin | masquer / rendre visible |
| `GET /api/statistiques` | admin | la page Fréquentation |

---

## Les données

Cinq tables. Elles sont créées au démarrage du serveur si elles manquent —
il n'y a pas de fichier de migration à jouer à la main.

```
utilisateurs             creations                photos
├ id                     ├ id                     ├ id
├ nom, prenom            ├ titre                  ├ creationId
├ type    admin | PA     ├ description            ├ ordre
├ mail    unique         ├ categorie              └ photo
├ Mdp     haché bcrypt   └ photo   (la couverture,
└ nombreConnexion                   recopiée ici)

connexions               categories
├ id                     ├ id
├ utilisateurId          ├ nom      unique
└ jour                   └ visible  0 = masquée aux membres
  unique(utilisateurId, jour)


Les liens

  photos.creationId        ──▶ creations.id      clé étrangère, suppression
                                                 en cascade
  connexions.utilisateurId ──▶ utilisateurs.id   idem

  creations.categorie      ┈┈▶ categories.nom    par le libellé,
                                                 sans clé étrangère
```

Deux choses à savoir :

**Le lien création ↔ catégorie passe par le libellé**, pas par un
identifiant. Renommer une catégorie met donc à jour les deux tables. En
contrepartie, une création peut porter un libellé libre qui n'a jamais été
déclaré, et rien ne casse.

**Le journal des connexions compte des personnes, pas des connexions.** La
contrainte d'unicité `(utilisateurId, jour)` fait que se reconnecter dix fois
dans la journée ne compte qu'une visite. La colonne `nombreConnexion`, elle,
compte bien chaque connexion.

---

## Catégories et visibilité

Une catégorie peut être **masquée** : elle disparaît alors, ainsi que toutes
ses créations, pour tout le monde sauf l'administratrice. Rien n'est
supprimé, et la bascule se fait à tout moment.

Le filtrage est fait **en SQL, sur chaque route qui expose une création ou
une image** — y compris celles qu'on atteint par identifiant direct. Masquer
doit rendre le contenu introuvable, pas seulement absent des listes : une
adresse devinée ou gardée en favori ne doit rien laisser passer.

Trois cas laissent une création visible de tous : pas de catégorie, une
catégorie marquée visible, ou un libellé libre jamais déclaré.

---

## Démarrer le projet en local

Il faut MySQL en marche, et Node 20 ou supérieur.

```bash
cp .env.example .env      # puis remplir DB_PASSWORD, SESSION_SECRET, ADMIN_*
npm install
cd album && npm install && cd ..

npm run dev               # lance l'API (3000) et le site (5173) ensemble
```

Le site est alors sur <http://localhost:5173>. En développement seulement,
Vite renvoie les adresses `/api/...` vers le port 3000 (c'est le `proxy` de
`vite.config.js`) : le code peut ainsi écrire `fetch('/api/photos')` sans
jamais nommer de port, et rester identique en production.

Autres commandes :

| Commande | Effet |
|---|---|
| `npm start` | l'API seule |
| `npm run seed` | dépose trois créations d'exemple dans une base vide |
| `npm run build` | compile le site dans `album/dist/` |

Le compte administrateur est créé au tout premier démarrage à partir de
`ADMIN_EMAIL` et `ADMIN_PASSWORD` — jamais écrit en dur dans le code.

---

## Partis pris

Quelques choix qui reviennent partout, et qu'il vaut mieux connaître avant de
modifier le projet :

- **Tout est en français** : noms de variables, de fonctions, de routes et
  commentaires. Les seules exceptions sont les mots imposés par les outils.
- **Peu de dépendances.** Les sessions et les jetons de réinitialisation sont
  signés avec le module `crypto` de Node, sans bibliothèque de JWT ; l'état
  partagé tient dans deux fichiers, sans bibliothèque de gestion d'état.
- **Le schéma se met à jour tout seul** au démarrage, et de façon rejouable :
  chaque évolution vérifie d'abord si elle a déjà été appliquée. Un
  redémarrage ne casse jamais rien.
- **Aucun secret dans le code.** Tout passe par `.env`, qui n'est jamais
  publié. Voir `.env.example` pour la liste complète des réglages.
- **Les messages d'erreur ne renseignent pas un attaquant** : une connexion
  ratée et une demande de réinitialisation donnent la même réponse, que le
  compte existe ou non.
- **Les valeurs SQL sont toujours passées à part**, à la place des `?`, et
  jamais collées dans le texte de la requête : c'est ce qui rend l'injection
  SQL impossible.

---

## Où regarder quand…

| Je veux… | Aller voir |
|---|---|
| changer un texte, une couleur, une mise en page | le `.vue` de l'écran concerné, dans `views/` |
| changer le menu de gauche | `components/NavBar.vue` |
| changer ce qu'une carte de la galerie affiche | `components/PhotoCard.vue` |
| ajouter un écran | `main.js` (la route) puis un fichier dans `views/` |
| changer une règle d'accès | les gardes de `server.js`, et `beforeEach` dans `main.js` |
| ajouter un champ à une création | la table `creations` dans `server.js`, les routes `/api/photos`, puis les formulaires |
| changer la taille des photos envoyées | `utils/image.js` |
| comprendre la connexion | `POST /api/login` dans `server.js`, et `stores/auth.js` |
| mettre en ligne | `DEPLOIEMENT.md` |
