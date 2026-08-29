// ===================================================================
//  server.js — le serveur (ce qu'on appelle « le back »)
// ===================================================================
//
//  Ce fichier est le programme qui tourne en permanence sur la machine
//  qui héberge le site. Il fait trois choses :
//
//    1. il parle à la base de données MySQL (lire/écrire les créations,
//       les comptes, les catégories) ;
//    2. il expose une « API » : des adresses en /api/... que le site Vue
//       appelle pour demander ou envoyer des données ;
//    3. en production, il sert aussi les fichiers du site lui-même
//       (voir tout en bas du fichier).
//
//  Le site Vue (dossier album/) ne touche JAMAIS à la base directement :
//  il passe toujours par ce serveur. C'est ce qui permet de contrôler qui
//  a le droit de faire quoi — un visiteur peut modifier son navigateur,
//  pas ce fichier.
//
//  Ordre de lecture conseillé :
//    - les outils de session (jeton, authentifier, adminSeulement)
//    - la création des tables
//    - puis les routes, qui sont le cœur du fichier
//
//  Vue d'ensemble du projet (les deux moitiés, les tables, le parcours
//  d'une requête) : voir README.md à la racine.
const express  = require('express')  // cadre qui gère les adresses HTTP
const cors     = require('cors')  // autorise le site (port 5173) à appeler l'API (port 3000)
const mysql    = require('mysql2/promise')  // client MySQL, version « promesses » (async/await)
const bcrypt   = require('bcryptjs')  // chiffrement à sens unique des mots de passe
const crypto   = require('crypto')  // signatures et aléatoire, fourni par Node
const path     = require('path')  // chemins de fichiers compatibles Windows/Mac/Linux
const nodemailer = require('nodemailer')  // envoi des emails


// Crée l'application. `app` recevra ensuite toutes les routes.
// Le port vient de l'hébergeur s'il en impose un, sinon 3000.
const app  = express()
const PORT = process.env.PORT || 3000


// `app.use` = « fais passer chaque requête par là ».
//   - cors()          : autorise les appels venus d'une autre adresse
//                       (indispensable en développement, où le site est
//                       sur le port 5173 et l'API sur le 3000) ;
//   - express.json()  : transforme le corps JSON reçu en objet JS,
//                       disponible dans `req.body`. La limite est haute
//                       parce que les photos transitent en base64.
app.use(cors())
app.use(express.json({ limit: '50mb' }))


// Réserve de connexions à MySQL. Plutôt que d'ouvrir puis fermer une
// connexion à chaque requête (lent), on garde un petit lot ouvert et on
// y pioche. `process.env.X` lit les variables d'environnement du
// fichier .env — voir .env.example ; la valeur après `||` sert de repli
// en développement.
const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'album',
    port:     parseInt(process.env.DB_PORT) || 3306
})

/* ------------------------------------------------------------------ *
 *  Sessions : jeton signé en HMAC-SHA256 (aucune dépendance externe)
 * ------------------------------------------------------------------ */


// Clé secrète qui sert à signer les jetons. Si elle change, tous les
// jetons déjà distribués deviennent invalides — d'où l'avertissement
// quand elle est tirée au hasard au démarrage.
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')
if (!process.env.SESSION_SECRET) {
    console.warn('⚠  SESSION_SECRET absent : secret temporaire généré. Les sessions seront perdues à chaque redémarrage.')
}

const DUREE_SESSION = 7 * 24 * 60 * 60 * 1000 // 7 jours


/* --- Briques communes aux jetons ------------------------------------ *
 *
 * Le projet fabrique deux sortes de jetons — celui de session, et celui
 * glissé dans le lien « mot de passe oublié ». Tous deux ont la même
 * forme :
 *
 *     corps.signature
 *
 * Le corps est un objet JSON encodé en base64 : lisible par tout le
 * monde, ce n'est pas un secret. La signature, elle, ne peut être
 * recalculée que par qui connaît la clé — c'est elle qui empêche de
 * fabriquer un jeton en changeant l'identifiant qu'il contient.
 *
 * Seule la clé de signature distingue les deux sortes de jetons. Les
 * cinq fonctions ci-dessous rassemblent tout le reste.
 */

// Le contenu du jeton, encodé en base64 « url » (sans / ni +).
function encoderCorps(contenu) {
    return Buffer.from(JSON.stringify(contenu)).toString('base64url')
}


// L'opération inverse. Renvoie null si le corps ne contient pas du JSON
// valide — ce qui arrive dès qu'un jeton a été bricolé à la main.
function decoderCorps(corps) {
    try {
        return JSON.parse(Buffer.from(corps, 'base64url').toString())
    } catch {
        return null
    }
}


// L'empreinte du corps, calculée avec la clé donnée.
function signerCorps(corps, cle) {
    return crypto.createHmac('sha256', cle).update(corps).digest('base64url')
}


// Sépare « corps.signature » en ses deux morceaux, ou renvoie null si le
// jeton n'a pas cette forme.
function decouperJeton(jeton) {
    if (!jeton) return null
    const [corps, signature] = String(jeton).split('.')
    if (!corps || !signature) return null
    return { corps, signature }
}


// Compare deux valeurs secrètes (signature, code d'invitation) en temps
// constant : une comparaison ordinaire s'arrête au premier caractère
// différent, ce qui permettrait de deviner la bonne valeur caractère par
// caractère, en mesurant le temps de réponse.
function memesSecrets(fournie, attendue) {
    const a = Buffer.from(String(fournie))
    const b = Buffer.from(String(attendue))
    // `timingSafeEqual` exige deux tampons de même longueur ; et une
    // longueur différente suffit de toute façon à conclure.
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
}


/* --- Jeton de session ----------------------------------------------- */

// `payload` vaut { id, exp } : le compte concerné, et jusqu'à quand le
// jeton reste valable.
function signerToken(payload) {
    const corps = encoderCorps(payload)
    return `${corps}.${signerCorps(corps, SECRET)}`
}


// Vérifie un jeton et renvoie son contenu, ou null s'il est invalide.
// Trois raisons de refuser, vérifiées dans cet ordre : forme incorrecte,
// signature qui ne correspond pas, date d'expiration dépassée.
function verifierToken(token) {
    const jeton = decouperJeton(token)
    if (!jeton) return null

    const attendue = signerCorps(jeton.corps, SECRET)
    if (!memesSecrets(jeton.signature, attendue)) return null

    // Signature valide : on peut décoder le contenu en confiance.
    const payload = decoderCorps(jeton.corps)
    if (!payload) return null

    // Encore faut-il que le jeton ne soit pas périmé.
    return payload.exp > Date.now() ? payload : null
}

// « Middleware » : une fonction placée devant une route. Elle s'exécute
// avant elle et décide si on continue (`next()`) ou si on répond tout
// de suite par une erreur. Ici : refuser les requêtes sans jeton valide,
// et attacher le compte trouvé à `req.utilisateur` pour la suite.
//
// Authentifie donc la requête — et le rôle est relu en base à chaque
// appel : un jeton ne doit jamais être la source de vérité sur les droits.
async function authentifier(req, res, next) {
    // Le site envoie le jeton dans l'en-tête « Authorization: Bearer xxx ».
    const entete = req.headers.authorization || ''
    const payload = verifierToken(entete.startsWith('Bearer ') ? entete.slice(7) : null)
    if (!payload) return res.status(401).json({ erreur: 'Session invalide ou expirée' })

    const [rows] = await pool.query(
        'SELECT id, nom, prenom, type, nombreConnexion, mail FROM utilisateurs WHERE id = ?',
        [payload.id]
    )
    if (!rows.length) return res.status(401).json({ erreur: 'Compte introuvable' })

    // Range le profil pour que la route qui suit puisse s'en servir.
    req.utilisateur = rows[0]
    next()  // tout va bien : on passe à la route
}


// Deuxième middleware, à placer APRÈS `authentifier` : il suppose que
// `req.utilisateur` est déjà rempli. Bloque tout le monde sauf
// l'administratrice (Manuela).
function adminSeulement(req, res, next) {
    if (req.utilisateur.type !== 'admin') {
        return res.status(403).json({ erreur: 'Action réservée à l\'administrateur' })
    }
    next()
}

// Un utilisateur ne peut agir que sur son propre compte (l'admin, sur tous).
function soiMeme(req, res, next) {
    const cible = String(req.params.id)
    if (cible !== String(req.utilisateur.id) && req.utilisateur.type !== 'admin') {
        return res.status(403).json({ erreur: 'Accès refusé' })
    }
    next()
}

/* ------------------------------------------------------------------ *
 *  Initialisation du schéma
 * ------------------------------------------------------------------ */


// Tout ce bloc ne s'exécute qu'une fois, au démarrage. Il est découpé en
// étapes nommées, enchaînées tout en bas par `preparerLaBase()`.
//
// Chaque étape est *rejouable* : elle commence par vérifier si son
// travail a déjà été fait. Le serveur peut donc redémarrer autant de fois
// qu'on veut, et une base ancienne se met à jour toute seule — il n'y a
// pas de fichier de migration à jouer à la main.
//
// ATTENTION : les commentaires ne peuvent pas être écrits à l'intérieur
// des blocs SQL entre accents graves — ils partiraient à MySQL. Ils sont
// donc placés juste au-dessus de chaque requête.


// Crée les cinq tables qui manquent. `IF NOT EXISTS` ne fait rien quand
// la table est déjà là.
async function creerLesTables() {
    // Les comptes.
    //   type            : 'admin' (Manuela) ou 'PA' (membre invité)
    //   nombreConnexion : compteur brut, incrémenté à chaque connexion
    //   Mdp             : le mot de passe *haché* par bcrypt, jamais en clair
    await pool.query(`
        CREATE TABLE IF NOT EXISTS utilisateurs (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            nom             VARCHAR(100) NOT NULL,
            prenom          VARCHAR(100) NOT NULL,
            type            VARCHAR(50) DEFAULT 'user',
            nombreConnexion INT DEFAULT 0,
            mail            VARCHAR(255) NOT NULL UNIQUE,
            Mdp             VARCHAR(255) NOT NULL
        )
    `)

    // Les créations couture. La colonne `photo` est celle de la première
    // version « une seule image » ; elle est conservée et tenue à jour
    // avec la couverture, mais les images vivent dans la table `photos`.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS creations (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            titre       VARCHAR(255) NOT NULL,
            description TEXT,
            photo       LONGBLOB
        )
    `)

    // Les catégories déclarées. Avoir cette table permet d'en créer une
    // avant qu'aucune création ne s'en réclame. Le libellé reste porté
    // par `creations.categorie` — renommer met les deux à jour.
    //
    // `visible` = 0 masque la catégorie et tout ce qu'elle contient aux
    // membres ; l'administratrice continue de la voir. Le drapeau se
    // change à tout moment, sans toucher aux créations.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
            id      INT AUTO_INCREMENT PRIMARY KEY,
            nom     VARCHAR(100) NOT NULL UNIQUE,
            visible TINYINT(1) NOT NULL DEFAULT 1
        )
    `)

    // Le journal des visites, à la journée : une ligne par personne et
    // par jour. La contrainte d'unicité fait que se reconnecter dix fois
    // dans la journée ne compte qu'une visite — c'est bien « combien de
    // personnes », pas « combien de connexions ».
    await pool.query(`
        CREATE TABLE IF NOT EXISTS connexions (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            utilisateurId INT NOT NULL,
            jour          DATE NOT NULL,
            UNIQUE KEY unique_visite (utilisateurId, jour),
            CONSTRAINT fk_connexions_utilisateur FOREIGN KEY (utilisateurId)
                REFERENCES utilisateurs(id) ON DELETE CASCADE
        )
    `)

    // Les photos. Une création peut en porter plusieurs ; `ordre` fixe
    // leur succession, et la première (ordre 0) sert de couverture.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS photos (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            creationId INT NOT NULL,
            ordre      INT NOT NULL DEFAULT 0,
            photo      LONGBLOB,
            CONSTRAINT fk_photos_creation FOREIGN KEY (creationId)
                REFERENCES creations(id) ON DELETE CASCADE
        )
    `)
}


// Ajoute une colonne à une table qui existait avant elle. On interroge le
// catalogue de MySQL pour savoir si elle est déjà là, plutôt que de
// tenter l'ajout et de rattraper l'erreur : l'appel reste ainsi rejouable
// sans rien salir dans les journaux.
//
// `table`, `colonne` et `definition` sont écrits dans le code juste en
// dessous, jamais reçus d'une requête : les insérer dans le texte SQL est
// ici sans danger (une colonne ne peut de toute façon pas être passée
// comme paramètre).
async function ajouterColonneSiAbsente(table, colonne, definition) {
    const [lignes] = await pool.query(`
        SELECT COUNT(*) AS presente FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `, [table, colonne])

    if (lignes[0].presente) return

    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${definition}`)
    console.log(`Colonne \`${colonne}\` ajoutée à la table ${table}.`)
}


// Bases d'avant la table `categories` : les libellés déjà employés par
// des créations y sont recopiés, pour qu'ils apparaissent dans la liste.
// `INSERT IGNORE` laisse passer sans erreur ceux qui y figurent déjà.
async function reprendreLesCategoriesDejaEmployees() {
    await pool.query(`
        INSERT IGNORE INTO categories (nom)
        SELECT DISTINCT categorie FROM creations
        WHERE categorie IS NOT NULL AND categorie <> ''
    `)
}


// Bases d'avant la table `photos` : l'image unique de chaque création
// devient sa première photo.
//
// La requête ne retient que les créations qui ont une image et aucune
// photo — celles déjà reprises sont donc ignorées, et la migration peut
// être rejouée sans créer de doublon. `creations.photo` n'est pas effacée.
async function reprendreLesPhotosDesAnciennesCreations() {
    const [aReprendre] = await pool.query(`
        SELECT c.id FROM creations c
        LEFT JOIN photos p ON p.creationId = c.id
        WHERE c.photo IS NOT NULL AND p.id IS NULL
    `)

    for (const { id } of aReprendre) {
        await pool.query(
            'INSERT INTO photos (creationId, ordre, photo) SELECT id, 0, photo FROM creations WHERE id = ?',
            [id]
        )
    }

    if (aReprendre.length) {
        console.log(`${aReprendre.length} création(s) reprise(s) dans la table photos.`)
    }
}


// Crée le compte administrateur au tout premier démarrage, à partir des
// variables d'environnement — jamais en dur dans le code. S'il en existe
// déjà un, on ne touche à rien.
async function creerAdministrateurSiAucun() {
    const [admins] = await pool.query('SELECT id FROM utilisateurs WHERE type = ? LIMIT 1', ['admin'])
    if (admins.length) return

    const mail = process.env.ADMIN_EMAIL
    const mdp  = process.env.ADMIN_PASSWORD
    if (!mail || !mdp) {
        console.warn('⚠  Aucun administrateur en base. Définissez ADMIN_EMAIL et ADMIN_PASSWORD puis redémarrez.')
        return
    }

    const hash = await bcrypt.hash(mdp, 10)
    await pool.query(
        'INSERT INTO utilisateurs (nom, prenom, type, nombreConnexion, mail, Mdp) VALUES (?, ?, ?, ?, ?, ?)',
        [process.env.ADMIN_NOM || 'Admin', process.env.ADMIN_PRENOM || '', 'admin', 0, mail, hash]
    )
    console.log(`Administrateur créé : ${mail}`)
}


// L'ordre compte : les tables d'abord, puis les colonnes ajoutées après
// coup, et seulement ensuite les reprises de données, qui s'appuient sur
// les unes et les autres.
async function preparerLaBase() {
    await creerLesTables()

    await ajouterColonneSiAbsente('creations', 'categorie', 'VARCHAR(100) NULL')
    await ajouterColonneSiAbsente('categories', 'visible', 'TINYINT(1) NOT NULL DEFAULT 1')

    await reprendreLesCategoriesDejaEmployees()
    await reprendreLesPhotosDesAnciennesCreations()

    await creerAdministrateurSiAucun()
}

// Rien n'attend cette préparation : le serveur commence à écouter tout de
// suite. Si elle échoue (base injoignable, droits manquants), le serveur
// ne peut rien faire d'utile — autant s'arrêter avec un message clair.
preparerLaBase().catch(erreur => {
    console.error('Préparation de la base impossible :', erreur.message)
    process.exit(1)
})

/* ------------------------------------------------------------------ *
 *  Envoi d'emails (réinitialisation de mot de passe)
 * ------------------------------------------------------------------ */


// Réglages d'envoi, tous lus dans le .env :
//   MAIL_MODE : 'sendmail' (programme local) ou 'smtp' (serveur distant)
//   SITE_URL  : adresse publique du site, utilisée dans les liens envoyés
//   MAIL_FROM : expéditeur affiché
// Le `.replace` retire un / final, sinon les liens auraient deux barres.
const SMTP_HOST = process.env.SMTP_HOST || ''
const MAIL_MODE = process.env.MAIL_MODE || (SMTP_HOST ? 'smtp' : '')
const SITE_URL  = (process.env.SITE_URL || '').replace(/\/$/, '')
const MAIL_FROM = process.env.SMTP_FROM || 'album@localhost'

// `transport` est l'objet qui sait envoyer ; il reste null si rien n'est configuré.
let transport = null
if (MAIL_MODE === 'sendmail') {
    // Sur un hébergement mutualisé, le binaire sendmail local évite
    // d'avoir à gérer des identifiants SMTP.
    transport = nodemailer.createTransport({
        sendmail: true,
        newline:  'unix',
        path:     process.env.SENDMAIL_PATH || '/usr/sbin/sendmail'
    })
} else if (MAIL_MODE === 'smtp') {
    transport = nodemailer.createTransport({
        host:   SMTP_HOST,
        port:   parseInt(process.env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE) === 'true',
        auth:   process.env.SMTP_USER
                    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
                    : undefined,
        // Sans ces limites, un serveur mail injoignable bloquerait la
        // requête HTTP indéfiniment.
        connectionTimeout: 10000,
        greetingTimeout:   10000,
        socketTimeout:     15000
    })
}

if (!transport) {
    console.warn('⚠  Aucun envoi d\'emails configuré (MAIL_MODE absent).')
}

// Envoi tolérant : un échec d'email ne doit jamais faire échouer
// l'action de l'utilisateur (connexion, inscription…).
async function envoyerMail(destinataire, sujet, texte) {
    if (!transport) return false
    try {
        await transport.sendMail({ from: MAIL_FROM, to: destinataire, subject: sujet, text: texte })
        return true
    } catch (e) {
        console.error(`Envoi email à ${destinataire} échoué :`, e.message)
        return false
    }
}

/* --- Les textes envoyés --------------------------------------------- *
 *
 * Écrits dans des chaînes à accents graves (`) : les retours à la ligne
 * sont ceux qu'on voit, au lieu d'être des \n à compter au milieu d'une
 * suite de concaténations. Les sortir des routes laisse celles-ci
 * lisibles, et permet de relire le message d'un coup d'œil.
 */

function messageDeBienvenue(prenom) {
    // Le lien n'est proposé que si l'adresse publique du site est connue.
    const invitation = SITE_URL ? ` :\n\n${SITE_URL}/login\n` : '.\n'

    return `Bonjour ${prenom},

Votre compte vient d'être créé sur l'album de créations couture
de Manuela. Bienvenue !

Vous pouvez dès maintenant vous connecter pour parcourir la galerie
et découvrir chaque création en détail${invitation}
Bonne visite,
— L'album couture
`
}


function messageDeReinitialisation(prenom, lien) {
    const avertissement = "Si vous n'êtes pas à l'origine de cette demande, "
        + 'ignorez ce message : votre mot de passe restera inchangé.'

    return `Bonjour ${prenom},

Vous avez demandé à réinitialiser votre mot de passe.
Cliquez sur ce lien, valable une heure :

${lien}

${avertissement}
`
}


// Jeton de réinitialisation : signé avec le hash du mot de passe actuel.
// Conséquence utile — dès que le mot de passe change, tous les jetons
// émis auparavant deviennent invalides. Pas de table à gérer.
const DUREE_RESET = 60 * 60 * 1000 // 1 heure


// La clé de signature : le secret du serveur, plus le mot de passe haché
// du compte. C'est ce second morceau qui fait qu'un changement de mot de
// passe invalide d'un coup tous les liens déjà envoyés.
function cleReset(hashDuMotDePasse) {
    return SECRET + hashDuMotDePasse
}


// Fabrique le jeton glissé dans le lien « mot de passe oublié ».
function signerReset(id, hashActuel, exp) {
    const corps = encoderCorps({ id, exp })
    return `${corps}.${signerCorps(corps, cleReset(hashActuel))}`
}


// Vérifie ce jeton et renvoie le compte concerné, ou null.
//
// L'ordre des vérifications est ici l'inverse de celui du jeton de
// session : la clé dépendant du mot de passe actuel, il faut d'abord
// lire le corps pour savoir de quel compte il s'agit, relire ce compte
// en base, et seulement alors pouvoir recalculer la signature.
async function verifierReset(token) {
    const jeton = decouperJeton(token)
    if (!jeton) return null

    const payload = decoderCorps(jeton.corps)
    if (!payload) return null
    if (!payload.exp || payload.exp < Date.now()) return null

    const [rows] = await pool.query('SELECT id, mail, Mdp FROM utilisateurs WHERE id = ?', [payload.id])
    if (!rows.length) return null

    const attendue = signerCorps(jeton.corps, cleReset(rows[0].Mdp))
    if (!memesSecrets(jeton.signature, attendue)) return null

    return rows[0]
}

/* ------------------------------------------------------------------ *
 *  Code d'invitation
 * ------------------------------------------------------------------ */

// Si INVITATION_CODE est défini, l'inscription l'exige. Sinon elle reste
// libre — pratique en développement, mais à définir en production.
const CODE_INVITATION = process.env.INVITATION_CODE || ''
if (!CODE_INVITATION) {
    console.warn('⚠  INVITATION_CODE absent : l\'inscription est ouverte à tous.')
}


// Compare le code saisi au code attendu. Aucun code configuré = aucune
// restriction : tout le monde peut s'inscrire.
function codeValide(fourni) {
    if (!CODE_INVITATION) return true
    return memesSecrets(fourni || '', CODE_INVITATION)
}

// Permet au formulaire de savoir s'il doit afficher le champ.
app.get('/api/inscription/config', (req, res) => {
    res.json({ codeRequis: !!CODE_INVITATION })
})

/* ------------------------------------------------------------------ *
 *  Routes publiques
 * ------------------------------------------------------------------ */


// CONNEXION.
// Reçoit { email, motDePasse }, renvoie un jeton et le profil.
// Le même message d'erreur est renvoyé si l'email est inconnu ou si le
// mot de passe est faux : sinon la page permettrait de tester quelles
// adresses sont inscrites.
app.post('/api/login', async (req, res) => {
    const { email, motDePasse } = req.body
    const [rows] = await pool.query('SELECT * FROM utilisateurs WHERE mail = ?', [email])
    if (!rows.length) return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' })

    // bcrypt ne sait pas déchiffrer : il rehache le mot de passe saisi et
    // compare les deux empreintes.
    const valide = await bcrypt.compare(motDePasse, rows[0].Mdp)
    if (!valide) return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' })

    await pool.query('UPDATE utilisateurs SET nombreConnexion = nombreConnexion + 1 WHERE id = ?', [rows[0].id])
    // INSERT IGNORE : la 2e connexion du jour ne crée pas de doublon.
    await pool.query('INSERT IGNORE INTO connexions (utilisateurId, jour) VALUES (?, CURDATE())', [rows[0].id])

    // Jeton valable 7 jours, que le site rangera dans le localStorage.
    const token = signerToken({ id: rows[0].id, exp: Date.now() + DUREE_SESSION })
    res.json({
        token,
        utilisateur: {
            id:     rows[0].id,
            mail:   rows[0].mail,
            nom:    rows[0].nom,
            prenom: rows[0].prenom,
            type:   rows[0].type
        }
    })
})


// INSCRIPTION d'un nouveau membre.
// Vérifie les champs, le code d'invitation et l'unicité de l'email,
// puis crée le compte avec le mot de passe haché.
app.post('/api/inscription', async (req, res) => {
    const { nom, prenom, mail, motDePasse, codeInvitation } = req.body
    if (!nom || !prenom || !mail || !motDePasse) {
        return res.status(400).json({ erreur: 'Tous les champs sont obligatoires' })
    }
    if (!codeValide(codeInvitation)) {
        return res.status(403).json({ erreur: 'Code d\'invitation incorrect' })
    }
    const [existing] = await pool.query('SELECT id FROM utilisateurs WHERE mail = ?', [mail])
    if (existing.length) return res.status(409).json({ erreur: 'Cet email est déjà utilisé' })

    // Le « 10 » est le coût du calcul : plus il est élevé, plus le hachage
    // est lent — pour nous d'un dixième de seconde, pour un attaquant qui
    // essaie des millions de mots de passe, rédhibitoire.
    const hash = await bcrypt.hash(motDePasse, 10)
    // `type` est imposé par le serveur : on ne le lit jamais depuis le client.
    await pool.query(
        'INSERT INTO utilisateurs (nom, prenom, type, nombreConnexion, mail, Mdp) VALUES (?, ?, ?, ?, ?, ?)',
        [nom, prenom, 'PA', 0, mail, hash]
    )

    // Email de bienvenue, sans attendre l'envoi : l'inscription ne doit
    // pas échouer si le serveur mail est indisponible.
    envoyerMail(
        mail,
        'Bienvenue sur l\'album couture de Manuela',
        messageDeBienvenue(prenom)
    ).catch(() => {})

    res.json({ success: true })
})

/* ------------------------------------------------------------------ *
 *  Mot de passe oublié
 * ------------------------------------------------------------------ */

app.get('/api/mot-de-passe-oublie/config', (req, res) => {
    res.json({ disponible: !!transport })
})


// DEMANDE de réinitialisation : envoie par email un lien valable 1 h.
app.post('/api/mot-de-passe-oublie', async (req, res) => {
    if (!transport) {
        return res.status(503).json({ erreur: 'L\'envoi d\'emails n\'est pas configuré sur ce serveur.' })
    }
    const { mail } = req.body
    if (!mail) return res.status(400).json({ erreur: 'Adresse email requise' })

    const [rows] = await pool.query('SELECT id, prenom, mail, Mdp FROM utilisateurs WHERE mail = ?', [mail])

    // Réponse identique que le compte existe ou non : sinon la page
    // permettrait de découvrir quelles adresses sont inscrites.
    if (rows.length) {
        const u    = rows[0]
        const lien = `${SITE_URL}/reinitialiser/${signerReset(u.id, u.Mdp, Date.now() + DUREE_RESET)}`
        await envoyerMail(
            u.mail,
            'Réinitialisation de votre mot de passe — Album couture',
            messageDeReinitialisation(u.prenom, lien)
        )
    }
    res.json({ success: true })
})


// VALIDATION du nouveau mot de passe, avec le jeton reçu par email.
app.post('/api/reinitialiser', async (req, res) => {
    const { token, motDePasse } = req.body
    if (!motDePasse || motDePasse.length < 8) {
        return res.status(400).json({ erreur: 'Le mot de passe doit faire au moins 8 caractères' })
    }
    const utilisateur = await verifierReset(token)
    if (!utilisateur) {
        return res.status(400).json({ erreur: 'Ce lien est invalide ou a expiré. Refaites une demande.' })
    }
    const hash = await bcrypt.hash(motDePasse, 10)
    await pool.query('UPDATE utilisateurs SET Mdp = ? WHERE id = ?', [hash, utilisateur.id])
    res.json({ success: true })
})

/* ------------------------------------------------------------------ *
 *  Utilisateurs — connexion requise, et son propre compte uniquement
 * ------------------------------------------------------------------ */


// Profil d'un membre. Les deux fonctions placées avant la route sont
// les gardes : être connecté (`authentifier`), et agir sur son propre
// compte (`soiMeme`). Le mot de passe n'est jamais renvoyé.
app.get('/api/utilisateurs/:id', authentifier, soiMeme, async (req, res) => {
    const [rows] = await pool.query(
        'SELECT id, nom, prenom, type, nombreConnexion, mail FROM utilisateurs WHERE id = ?',
        [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ erreur: 'Utilisateur non trouvé' })
    res.json(rows[0])
})


// Modification du profil. Le mot de passe n'est changé que s'il est
// fourni : le formulaire laisse le champ vide quand on ne veut pas y
// toucher.
app.put('/api/utilisateurs/:id', authentifier, soiMeme, async (req, res) => {
    const { nom, prenom, mail, motDePasse } = req.body
    const [existing] = await pool.query('SELECT id FROM utilisateurs WHERE mail = ? AND id != ?', [mail, req.params.id])
    if (existing.length) return res.status(409).json({ erreur: 'Cet email est déjà utilisé' })

    if (motDePasse) {
        const hash = await bcrypt.hash(motDePasse, 10)
        await pool.query('UPDATE utilisateurs SET nom = ?, prenom = ?, mail = ?, Mdp = ? WHERE id = ?', [nom, prenom, mail, hash, req.params.id])
    } else {
        await pool.query('UPDATE utilisateurs SET nom = ?, prenom = ?, mail = ? WHERE id = ?', [nom, prenom, mail, req.params.id])
    }
    res.json({ success: true })
})


// Suppression du compte. Les visites journalisées partent avec, grâce au
// ON DELETE CASCADE posé sur la table `connexions`.
app.delete('/api/utilisateurs/:id', authentifier, soiMeme, async (req, res) => {
    await pool.query('DELETE FROM utilisateurs WHERE id = ?', [req.params.id])
    res.json({ success: true })
})

/* ------------------------------------------------------------------ *
 *  Photos — lecture pour tout membre connecté, écriture pour l'admin
 * ------------------------------------------------------------------ */

const LIMITE_PHOTOS = 12  // nombre maximal de photos par création

// Une catégorie vide vaut « non classée » (NULL) plutôt qu'une chaîne
// vide : sans ça, "" et NULL formeraient deux groupes distincts.
function nettoyerCategorie(valeur) {
    if (typeof valeur !== 'string') return null
    const propre = valeur.trim().slice(0, 100)
    return propre.length ? propre : null
}

/* --- Catégories masquées ------------------------------------------- *
 *
 * Une création est visible si sa catégorie ne l'est pas moins. Trois cas
 * la laissent visible de tous : pas de catégorie du tout, une catégorie
 * marquée visible, ou un libellé libre absent de la table `categories`
 * (rien n'a jamais été déclaré à son sujet).
 *
 * Le filtrage est fait en SQL, sur chaque route qui expose une création
 * ou une image — y compris celles qu'on atteint par identifiant direct.
 * Masquer une catégorie doit rendre son contenu introuvable, pas
 * seulement absent des listes.
 */
const JOINTURE_VISIBILITE = 'LEFT JOIN categories cat ON cat.nom = c.categorie'
const CONDITION_VISIBLE   = '(cat.id IS NULL OR cat.visible = 1)'

// Morceau de SQL à coller sous un WHERE déjà commencé. Vide pour
// l'administratrice, qui voit tout ; sinon « AND (…) ».
//
// Dans les requêtes ci-dessous, l'appel est mis sur sa propre ligne pour
// qu'on lise la condition à sa place naturelle.
function filtreVisibilite(utilisateur) {
    return utilisateur.type === 'admin' ? '' : `AND ${CONDITION_VISIBLE}`
}

// Les images sont stockées en « data URL », une chaîne de la forme :
//
//     data:image/png;base64,iVBORw0KGgoAAAANSU...
//     └──┬───┘ └───┬───┘        └──────┬──────┘
//      préfixe    type            l'image encodée
//
// Cette expression régulière en isole les deux morceaux utiles. Le
// drapeau `s` permet au point de couvrir aussi les retours à la ligne,
// qu'un encodage en base64 peut contenir.
const FORMAT_DATA_URL = /^data:(?<type>[^;]+);base64,(?<contenu>.*)$/s


// Renvoie l'image décodée en binaire plutôt qu'en base64 : un tiers de
// poids en moins, et le navigateur peut la mettre en cache.
function envoyerImage(res, dataUrl) {
    const trouve = FORMAT_DATA_URL.exec(dataUrl)
    if (!trouve) return res.status(415).json({ erreur: 'Format d\'image non reconnu' })

    const { type, contenu } = trouve.groups
    res.set('Content-Type', type)
    res.set('Cache-Control', 'private, max-age=86400')
    res.send(Buffer.from(contenu, 'base64'))
}

/* --- Le protocole « conserver: » ------------------------------------ *
 *
 * Quand on modifie une création, le formulaire renvoie la liste complète
 * de ses photos, dans l'ordre voulu. Deux sortes d'entrées s'y mêlent :
 *
 *     "data:image/jpeg;base64,..."   une nouvelle photo, à enregistrer
 *     "conserver:42"                 la photo n° 42, déjà en base
 *
 * La seconde forme évite de renvoyer au serveur des images qu'il possède
 * déjà : seul leur rang change. C'est ce qui rend la modification légère,
 * même sur une création de douze photos.
 *
 * Le formulaire qui produit ces valeurs est album/src/views/ModifierView.vue.
 */
const PREFIXE_CONSERVER = 'conserver:'


// Traduit la liste reçue en instructions explicites, une par photo :
//
//     { rang: 0, dejaEnBase: true,  id: 42 }        → à renuméroter
//     { rang: 1, dejaEnBase: false, image: '...' }  → à insérer
//
// Le rang est la position dans la liste ; 0 est la couverture.
function lireListeDePhotos(images) {
    return images.map((valeur, rang) => valeur.startsWith(PREFIXE_CONSERVER)
        ? { rang, dejaEnBase: true,  id: Number(valeur.slice(PREFIXE_CONSERVER.length)) }
        : { rang, dejaEnBase: false, image: valeur })
}


// Accepte `photos: [...]` (plusieurs) ou `photo: "..."` (ancien format,
// une seule) et renvoie une liste propre, bornée.
function normaliserImages(corps) {
    const brut = Array.isArray(corps.photos)
        ? corps.photos
        : (corps.photo ? [corps.photo] : [])
    return brut
        .filter(v => typeof v === 'string' && v.length)
        .slice(0, LIMITE_PHOTOS)
}

// LISTE des créations, pour la galerie.
//
// Liste SANS les images : quelques centaines d'octets au lieu de plusieurs
// Mo. La galerie s'affiche aussitôt, chaque vignette se charge ensuite
// pour son compte via /api/photos/:id/image.
app.get('/api/photos', authentifier, async (req, res) => {
    // La requête est assemblée morceau par morceau : `conditions` recueille
    // les filtres, `valeurs` ce qui ira à la place des `?`. Les valeurs ne
    // sont jamais collées dans le texte SQL — c'est ce qui rend l'injection
    // SQL impossible.
    const conditions = []
    const valeurs    = []

    // `?categorie=` filtre la galerie ; « sans » cible les créations qui
    // n'ont pas encore été classées.
    const categorieDemandee = req.query.categorie
    if (categorieDemandee === 'sans') {
        conditions.push('(c.categorie IS NULL OR c.categorie = "")')
    } else if (categorieDemandee) {
        conditions.push('c.categorie = ?')
        valeurs.push(categorieDemandee)
    }

    // Une catégorie masquée demandée explicitement — adresse devinée, page
    // gardée en favori — ne renvoie rien de plus que la galerie complète.
    if (req.utilisateur.type !== 'admin') conditions.push(CONDITION_VISIBLE)

    const filtres = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [lignes] = await pool.query(`
        SELECT c.id, c.titre, c.description, c.categorie, COUNT(p.id) AS nbPhotos
        FROM creations c
        LEFT JOIN photos p ON p.creationId = c.id
        ${JOINTURE_VISIBILITE}
        ${filtres}
        GROUP BY c.id, c.titre, c.description, c.categorie
        ORDER BY c.id
    `, valeurs)

    // Le COUNT revient en chaîne de caractères : on le reconvertit en
    // nombre avant de l'envoyer au site.
    res.json(lignes.map(ligne => ({ ...ligne, nbPhotos: Number(ligne.nbPhotos) })))
})

// Catégories déclarées, avec le nombre de créations de chacune. Une
// catégorie encore vide apparaît donc, avec un compte à zéro. Les
// catégories masquées ne sortent que pour l'administratrice.
app.get('/api/categories', authentifier, async (req, res) => {
    const [rows] = await pool.query(`
        SELECT cat.id, cat.nom, cat.visible, COUNT(c.id) AS nombre
        FROM categories cat
        LEFT JOIN creations c ON c.categorie = cat.nom
        ${req.utilisateur.type === 'admin' ? '' : 'WHERE cat.visible = 1'}
        GROUP BY cat.id, cat.nom, cat.visible
        ORDER BY cat.nom
    `)
    // Les créations non classées restent visibles de tous : masquer se
    // fait par catégorie, et « non classées » n'en est pas une.
    const [sans] = await pool.query(`
        SELECT COUNT(*) AS nombre FROM creations
        WHERE categorie IS NULL OR categorie = ''
    `)
    res.json({
        categories: rows.map(r => ({
            id: r.id, nom: r.nom, nombre: Number(r.nombre), visible: !!r.visible
        })),
        sansCategorie: Number(sans[0].nombre)
    })
})


// Création d'une catégorie (réservée à l'administratrice).
app.post('/api/categories', authentifier, adminSeulement, async (req, res) => {
    const nom = nettoyerCategorie(req.body.nom)
    if (!nom) return res.status(400).json({ erreur: 'Le nom est obligatoire' })

    // Visible par défaut : on ne masque que si c'est demandé.
    const visible = req.body.visible === false ? 0 : 1

    // On renvoie le libellé déjà en base, pas celui saisi : si la
    // différence n'est qu'une casse ou un espace, autant la montrer.
    const [existe] = await pool.query('SELECT nom FROM categories WHERE nom = ?', [nom])
    if (existe.length) {
        return res.status(409).json({ erreur: `La catégorie « ${existe[0].nom} » existe déjà` })
    }

    const [r] = await pool.query('INSERT INTO categories (nom, visible) VALUES (?, ?)', [nom, visible])
    res.json({ id: r.insertId, nom, nombre: 0, visible: !!visible })
})

// Masquer ou remontrer une catégorie. Route à part du renommage : c'est
// une bascule, elle ne doit pas obliger à renvoyer le nom.
app.patch('/api/categories/:id/visibilite', authentifier, adminSeulement, async (req, res) => {
    if (typeof req.body.visible !== 'boolean') {
        return res.status(400).json({ erreur: 'Le champ `visible` doit valoir true ou false' })
    }
    // Existence vérifiée à part : MySQL ne compte pas comme « affectée »
    // une ligne réécrite à l'identique, une bascule sans effet passerait
    // donc pour une catégorie introuvable.
    const [actuelle] = await pool.query('SELECT id FROM categories WHERE id = ?', [req.params.id])
    if (!actuelle.length) return res.status(404).json({ erreur: 'Catégorie introuvable' })

    await pool.query('UPDATE categories SET visible = ? WHERE id = ?',
        [req.body.visible ? 1 : 0, req.params.id])
    res.json({ success: true, visible: req.body.visible })
})


// RENOMMAGE d'une catégorie. Deux mises à jour : la table `categories`,
// puis le libellé recopié dans chaque création concernée.
app.put('/api/categories/:id', authentifier, adminSeulement, async (req, res) => {
    const nom = nettoyerCategorie(req.body.nom)
    if (!nom) return res.status(400).json({ erreur: 'Le nom est obligatoire' })

    const [actuelle] = await pool.query('SELECT nom FROM categories WHERE id = ?', [req.params.id])
    if (!actuelle.length) return res.status(404).json({ erreur: 'Catégorie introuvable' })

    const [collision] = await pool.query('SELECT id FROM categories WHERE nom = ? AND id <> ?', [nom, req.params.id])
    if (collision.length) return res.status(409).json({ erreur: 'Une autre catégorie porte déjà ce nom' })

    await pool.query('UPDATE categories SET nom = ? WHERE id = ?', [nom, req.params.id])
    // Le libellé est recopié dans les créations : on les suit.
    await pool.query('UPDATE creations SET categorie = ? WHERE categorie = ?', [nom, actuelle[0].nom])
    res.json({ success: true })
})


// SUPPRESSION d'une catégorie — les créations, elles, sont conservées.
app.delete('/api/categories/:id', authentifier, adminSeulement, async (req, res) => {
    const [actuelle] = await pool.query('SELECT nom FROM categories WHERE id = ?', [req.params.id])
    if (!actuelle.length) return res.status(404).json({ erreur: 'Catégorie introuvable' })

    // Les créations ne sont jamais supprimées : elles redeviennent
    // simplement « non classées ».
    const [maj] = await pool.query('UPDATE creations SET categorie = NULL WHERE categorie = ?', [actuelle[0].nom])
    await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id])
    res.json({ success: true, declassees: maj.affectedRows })
})

/* ------------------------------------------------------------------ *
 *  Statistiques de fréquentation — réservées à l'administrateur
 * ------------------------------------------------------------------ */


// PAGE FRÉQUENTATION. Trois requêtes, une par bloc de la page.
app.get('/api/statistiques', authentifier, adminSeulement, async (req, res) => {
    // DATE_FORMAT plutôt que l'objet Date : évite tout décalage de fuseau
    // entre le serveur et le navigateur, qui ferait glisser une visite
    // d'un jour à l'autre.
    // Les 90 derniers jours ayant eu au moins une visite, avec le nombre de
    // personnes et leurs noms (GROUP_CONCAT colle les noms du jour en une
    // seule chaîne, que la page affiche telle quelle).
    const [parJour] = await pool.query(`
        SELECT DATE_FORMAT(cx.jour, '%Y-%m-%d') AS jour,
               COUNT(*) AS personnes,
               GROUP_CONCAT(CONCAT(u.prenom, ' ', u.nom) ORDER BY u.prenom SEPARATOR ', ') AS qui
        FROM connexions cx
        JOIN utilisateurs u ON u.id = cx.utilisateurId
        GROUP BY cx.jour
        ORDER BY cx.jour DESC
        LIMIT 90
    `)
    // Pour chaque inscrit : son nombre de jours de visite et sa dernière
    // venue. Le LEFT JOIN garde les membres jamais venus, et le tri les
    // renvoie en dernier (leur date est nulle).
    const [membres] = await pool.query(`
        SELECT u.id, u.prenom, u.nom, u.type, u.nombreConnexion,
               DATE_FORMAT(MAX(cx.jour), '%Y-%m-%d') AS derniereVisite,
               COUNT(cx.id) AS joursDeVisite
        FROM utilisateurs u
        LEFT JOIN connexions cx ON cx.utilisateurId = u.id
        GROUP BY u.id, u.prenom, u.nom, u.type, u.nombreConnexion
        ORDER BY MAX(cx.jour) IS NULL, MAX(cx.jour) DESC
    `)
    // Le nombre d'inscrits, affiché dans la première tuile.
    const [total] = await pool.query('SELECT COUNT(*) AS nombre FROM utilisateurs')

    res.json({
        parJour: parJour.map(r => ({ jour: r.jour, personnes: Number(r.personnes), qui: r.qui })),
        membres: membres.map(r => ({
            id: r.id, prenom: r.prenom, nom: r.nom, type: r.type,
            nombreConnexion: Number(r.nombreConnexion),
            derniereVisite: r.derniereVisite,
            joursDeVisite: Number(r.joursDeVisite)
        })),
        nombreMembres: Number(total[0].nombre)
    })
})

// Une image quelconque, par son identifiant propre.
app.get('/api/images/:imageId', authentifier, async (req, res) => {
    const [rows] = await pool.query(`
        SELECT p.photo FROM photos p
        JOIN creations c ON c.id = p.creationId
        ${JOINTURE_VISIBILITE}
        WHERE p.id = ?
        ${filtreVisibilite(req.utilisateur)}
    `, [req.params.imageId])
    if (!rows.length || !rows[0].photo) return res.status(404).end()
    envoyerImage(res, rows[0].photo.toString())
})

// Photo de couverture d'une création (la première dans l'ordre).
app.get('/api/photos/:id/image', authentifier, async (req, res) => {
    const [rows] = await pool.query(`
        SELECT p.photo FROM photos p
        JOIN creations c ON c.id = p.creationId
        ${JOINTURE_VISIBILITE}
        WHERE p.creationId = ?
        ${filtreVisibilite(req.utilisateur)}
        ORDER BY p.ordre, p.id LIMIT 1
    `, [req.params.id])
    if (!rows.length || !rows[0].photo) return res.status(404).end()
    envoyerImage(res, rows[0].photo.toString())
})

// Détail d'une création : ses métadonnées et la liste de ses photos,
// sous forme d'identifiants seulement — chacune est ensuite chargée
// séparément par la page.
app.get('/api/photos/:id', authentifier, async (req, res) => {
    const [rows] = await pool.query(`
        SELECT c.id, c.titre, c.description, c.categorie
        FROM creations c
        ${JOINTURE_VISIBILITE}
        WHERE c.id = ?
        ${filtreVisibilite(req.utilisateur)}
    `, [req.params.id])
    if (!rows.length) return res.status(404).json({ erreur: 'Non trouvé' })

    const [images] = await pool.query(
        'SELECT id, ordre FROM photos WHERE creationId = ? ORDER BY ordre, id',
        [req.params.id]
    )
    res.json({ ...rows[0], images })
})


// AJOUT d'une création. Le corps contient le titre, la description, la
// catégorie et les photos (chacune en « data URL » base64, produite par
// le navigateur après redimensionnement).
app.post('/api/photos', authentifier, adminSeulement, async (req, res) => {
    const { titre, description } = req.body
    if (!titre) return res.status(400).json({ erreur: 'Le titre est obligatoire' })

    const images = normaliserImages(req.body)
    if (!images.length) return res.status(400).json({ erreur: 'Au moins une photo est requise' })

    const [result] = await pool.query(
        'INSERT INTO creations (titre, description, categorie, photo) VALUES (?, ?, ?, ?)',
        [titre, description || '', nettoyerCategorie(req.body.categorie), images[0]]
    )
    // Une ligne par photo ; `i` devient son rang (0 = couverture).
    for (const [i, img] of images.entries()) {
        await pool.query('INSERT INTO photos (creationId, ordre, photo) VALUES (?, ?, ?)', [result.insertId, i, img])
    }
    res.json({ id: result.insertId, titre, description, nbPhotos: images.length })
})


// Supprime les photos de la création qui ne figurent plus dans la liste
// voulue. Une liste sans aucune photo conservée efface donc tout.
async function supprimerLesPhotosAbsentes(creationId, idsAGarder) {
    if (!idsAGarder.length) {
        await pool.query('DELETE FROM photos WHERE creationId = ?', [creationId])
        return
    }

    // Un `?` par identifiant à garder : on fabrique le bon nombre de
    // marqueurs, et les valeurs restent passées à part.
    const marqueurs = idsAGarder.map(() => '?').join(', ')
    await pool.query(
        `DELETE FROM photos WHERE creationId = ? AND id NOT IN (${marqueurs})`,
        [creationId, ...idsAGarder]
    )
}


// Donne à chaque photo son rang définitif : les conservées sont
// renumérotées sur place, les nouvelles insérées au leur.
async function rangerLesPhotos(creationId, souhaitees) {
    for (const photo of souhaitees) {
        if (photo.dejaEnBase) {
            await pool.query(
                'UPDATE photos SET ordre = ? WHERE id = ? AND creationId = ?',
                [photo.rang, photo.id, creationId]
            )
        } else {
            await pool.query(
                'INSERT INTO photos (creationId, ordre, photo) VALUES (?, ?, ?)',
                [creationId, photo.rang, photo.image]
            )
        }
    }
}


// `creations.photo` est la colonne héritée de la première version du
// projet. La galerie ne la lit plus, mais on la tient à jour avec la
// photo de couverture pour que les deux ne finissent pas par raconter des
// choses différentes.
async function mettreAJourLaCouverture(creationId) {
    const [premiere] = await pool.query(
        'SELECT photo FROM photos WHERE creationId = ? ORDER BY ordre, id LIMIT 1',
        [creationId]
    )
    await pool.query(
        'UPDATE creations SET photo = ? WHERE id = ?',
        [premiere.length ? premiere[0].photo : null, creationId]
    )
}


// MODIFICATION d'une création.
//
// Le cas délicat est celui des photos : la page d'édition renvoie la
// liste complète dans son nouvel ordre, en mélangeant photos déjà
// stockées et nouvelles (voir le protocole « conserver: » plus haut). On
// aligne alors la base sur cette liste, en trois temps.
app.put('/api/photos/:id', authentifier, adminSeulement, async (req, res) => {
    const creationId = req.params.id
    const { titre, description } = req.body

    await pool.query(
        'UPDATE creations SET titre = ?, description = ?, categorie = ? WHERE id = ?',
        [titre, description || '', nettoyerCategorie(req.body.categorie), creationId]
    )

    // `photos` absent du corps : seuls le titre et la description changent,
    // les images restent en place.
    if (req.body.photos === undefined && req.body.photo === undefined) {
        return res.json({ success: true })
    }

    const images = normaliserImages(req.body)
    if (!images.length) return res.status(400).json({ erreur: 'Au moins une photo est requise' })

    const souhaitees = lireListeDePhotos(images)
    const idsAGarder = souhaitees.filter(photo => photo.dejaEnBase).map(photo => photo.id)

    await supprimerLesPhotosAbsentes(creationId, idsAGarder)
    await rangerLesPhotos(creationId, souhaitees)
    await mettreAJourLaCouverture(creationId)

    res.json({ success: true })
})


// SUPPRESSION d'une création. Ses photos suivent, via ON DELETE CASCADE.
app.delete('/api/photos/:id', authentifier, adminSeulement, async (req, res) => {
    await pool.query('DELETE FROM creations WHERE id = ?', [req.params.id])
    res.json({ success: true })
})

/* ------------------------------------------------------------------ *
 *  Front Vue (build de production)
 * ------------------------------------------------------------------ */

// En production, le site Vue a été compilé dans album/dist : on sert ces
// fichiers (JS, CSS, images) tels quels.
app.use(express.static(path.join(__dirname, 'album', 'dist')))
// Toute autre adresse renvoie index.html. C'est indispensable pour une
// « application à page unique » : /galerie n'existe pas comme fichier,
// c'est le routeur Vue qui, une fois la page chargée, affiche le bon
// écran. Sans cette ligne, recharger /galerie donnerait une erreur 404.
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'album', 'dist', 'index.html'))
})

// Démarre l'écoute : à partir d'ici, le serveur répond.
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`))
