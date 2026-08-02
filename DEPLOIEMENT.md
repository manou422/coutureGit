# Mettre l'album en ligne sur Alwaysdata

Objectif : un site accessible à ta famille depuis n'importe où, à une adresse
du type `https://couture.alwaysdata.net`.

Tout ce qui suit se fait **une seule fois**. Compte ~30 minutes.

---

## Avant de commencer : changer les deux mots de passe compromis

Ils ont été publiés sur GitHub et restent lisibles dans l'historique du dépôt.
Tant qu'ils sont valables, le reste ne sert à rien.

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

Depuis ton PC, dans le dossier du projet :

```bash
ssh couture@ssh-couture.alwaysdata.net
git clone https://github.com/manou422/coutureGit.git ~/www
cd ~/www
npm install --omit=dev
```

`npm install` à la racine n'installe que le serveur (Express, MySQL, bcrypt) :
quelques Mo. **N'installe pas** les dépendances de `album/` sur le serveur,
elles dépassent le quota gratuit.

## 4. Envoyer le build du site

Le dossier `album/dist` n'est pas dans Git. Construis-le sur ton PC :

```bash
cd album
npm run build
```

Puis envoie-le (depuis ton PC, pas depuis le SSH) :

```bash
scp -r album/dist couture@ssh-couture.alwaysdata.net:~/www/album/
```

À refaire à chaque fois que tu modifies l'apparence du site.

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

```bash
# sur ton PC : construire et envoyer le front
cd album && npm run build
scp -r dist couture@ssh-couture.alwaysdata.net:~/www/album/

# sur le serveur : récupérer le code
ssh couture@ssh-couture.alwaysdata.net
cd ~/www && git pull && npm install --omit=dev
```

Puis **Redémarrer** le site dans l'administration Alwaysdata.

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
