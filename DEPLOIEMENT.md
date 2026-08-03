# Mettre l'album en ligne sur Alwaysdata

Objectif : un site accessible à ta famille depuis n'importe où, à une adresse
du type `https://couture.alwaysdata.net`.

Tout ce qui suit se fait **une seule fois**. Compte ~30 minutes.

---

## Avant de commencer : changer les deux mots de passe

Le dépôt GitHub est privé aujourd'hui, mais il a été **public jusqu'au
2 août 2026**, avec ces deux mots de passe en clair dans le code. GitHub
étant scanné en permanence par des robots collecteurs de secrets, il faut
les considérer comme connus. Ce n'est plus urgent, mais c'est à faire.

Si tu n'en changes qu'un, prends celui de MySQL : c'est celui qui ouvre
toute la base.

1. **Mot de passe MySQL local** — dans MySQL Workbench ou en ligne de commande :
   ```sql
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'un-nouveau-mot-de-passe';
   ```
   Puis reporte-le dans le fichier `.env` à la racine du projet (`DB_PASSWORD=`).

2. **Mot de passe du compte admin** — connecte-toi sur le site local, va dans
   « Compte » → « Modifier », et saisis un nouveau mot de passe.

Le fichier `.env` n'est jamais publié : il est listé dans `.gitignore`.

---

## 1. Créer le compte Alwaysdata

Sur https://www.alwaysdata.com → « Créer un compte » → offre **gratuite (100 Mo)**.

Choisis un nom de compte, par exemple `couture`. Il détermine l'adresse du site :
`https://couture.alwaysdata.net`.

## 2. Créer la base de données

Dans l'administration : **Bases de données → MySQL → Ajouter une base**.

- Nom : `couture_album`
- Coche « Créer un utilisateur associé », et note le mot de passe généré

Note ces cinq valeurs, elles serviront à l'étape 5 :

| Champ | Où le trouver |
|---|---|
| hôte | `mysql-couture.alwaysdata.net` |
| port | `3306` |
| base | `couture_album` |
| utilisateur | celui créé ci-dessus |
| mot de passe | celui généré ci-dessus |

## 3. Envoyer le code

Dans **Accès distant → SSH**, active l'accès et note l'identifiant.

> Le dépôt GitHub est **privé** : un `git clone` depuis le serveur Alwaysdata
> échouerait, faute d'authentification. On envoie donc les fichiers
> directement depuis ton PC. C'est aussi plus simple : rien à configurer
> côté GitHub.

D'abord, construis le site sur ton PC :

```bash
cd album
npm run build
cd ..
```

Puis envoie le projet (une seule commande, depuis la racine du projet) :

```bash
rsync -av --delete \
  --exclude node_modules --exclude .git --exclude .env \
  ./ couture@ssh-couture.alwaysdata.net:~/www/
```

`--exclude .env` est important : tes mots de passe locaux ne doivent pas
partir sur le serveur, qui a sa propre configuration (étape 5).

Enfin, installe les dépendances du serveur :

```bash
ssh couture@ssh-couture.alwaysdata.net
cd ~/www && npm install --omit=dev
```

Cela n'installe que le serveur (Express, MySQL, bcrypt) : quelques Mo.
**N'installe pas** les dépendances de `album/` sur le serveur, elles
dépassent largement le quota gratuit.

### Si `rsync` n'est pas disponible sur ton PC

Sous Windows, `rsync` est fourni avec Git Bash. S'il manque, remplace la
commande par :

```bash
scp -r server.js seed.js package.json package-lock.json album/dist \
  couture@ssh-couture.alwaysdata.net:~/www/
```

en veillant à ce que `~/www/album/dist` existe côté serveur.

## 5. Configurer les variables d'environnement

Dans **Environnement → Variables d'environnement**, ajoute :

| Nom | Valeur |
|---|---|
| `DB_HOST` | `mysql-couture.alwaysdata.net` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `couture_album` |
| `DB_USER` | l'utilisateur de l'étape 2 |
| `DB_PASSWORD` | le mot de passe de l'étape 2 |
| `SESSION_SECRET` | voir ci-dessous |
| `ADMIN_EMAIL` | ton adresse email |
| `ADMIN_PASSWORD` | un mot de passe solide, **différent** du local |

Génère `SESSION_SECRET` sur ton PC :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

C'est la clé qui signe les sessions. Si elle change, tout le monde est
déconnecté — ce n'est pas grave, mais évite de la modifier sans raison.

`ADMIN_EMAIL` et `ADMIN_PASSWORD` ne servent qu'au tout premier démarrage,
pour créer ton compte administrateur dans la base vide.

## 6. Créer le site

Dans **Web → Sites → Ajouter un site** :

- Adresse : `couture.alwaysdata.net`
- Type : **Node.js**
- Répertoire de travail : `/home/couture/www`
- Commande : `node server.js`
- Version de Node : 20 ou supérieure

Alwaysdata impose le port via la variable `PORT`, que `server.js` lit déjà.

Clique sur **Redémarrer**, puis ouvre `https://couture.alwaysdata.net`.

## 7. Créer les comptes de ta famille

Chaque personne s'inscrit elle-même depuis le lien, via « Créer un compte ».
Elle reçoit automatiquement le rôle `PA` : elle peut **voir** l'album, mais
ni ajouter, ni modifier, ni supprimer. Toi seule as ces droits.

Il n'y a pas de validation à l'inscription : toute personne connaissant
l'adresse peut créer un compte et voir tes créations. Pour restreindre
davantage, il faudrait ajouter un code d'invitation — dis-le-moi si tu veux.

---

## Mettre à jour le site plus tard

Depuis la racine du projet, sur ton PC :

```bash
cd album && npm run build && cd ..
rsync -av --delete \
  --exclude node_modules --exclude .git --exclude .env \
  ./ couture@ssh-couture.alwaysdata.net:~/www/
```

Puis **Redémarrer** le site dans l'administration Alwaysdata.

Inutile de relancer `npm install`, sauf si tu as ajouté une dépendance
au serveur.

---

## Attention à l'espace disque

L'offre gratuite est limitée à **100 Mo**, base de données comprise.

Les photos sont stockées en base64 dans MySQL, ce qui augmente leur poids
d'environ un tiers. Ta photo « Pochon 1 » fait 4,6 Mo, soit **6 Mo en base**.
À ce rythme, tu sauras stocker une quinzaine de créations.

Le réflexe simple : **redimensionner tes photos avant de les ajouter**
(1 500 px de large suffisent largement pour un album web, soit ~300 Ko par
photo, donc plus de 200 créations). N'importe quel outil de retouche le fait,
ou le site https://squoosh.app directement dans le navigateur.

Si tu veux dépasser ça, la vraie solution est de stocker les images comme
fichiers plutôt que dans la base — c'est un chantier à part.
