const express  = require('express')
const cors     = require('cors')
const mysql    = require('mysql2/promise')
const bcrypt   = require('bcryptjs')
const crypto   = require('crypto')
const path     = require('path')
const nodemailer = require('nodemailer')

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '50mb' }))

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

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')
if (!process.env.SESSION_SECRET) {
    console.warn('⚠  SESSION_SECRET absent : secret temporaire généré. Les sessions seront perdues à chaque redémarrage.')
}

const DUREE_SESSION = 7 * 24 * 60 * 60 * 1000 // 7 jours

function signerToken(payload) {
    const corps = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const sig   = crypto.createHmac('sha256', SECRET).update(corps).digest('base64url')
    return `${corps}.${sig}`
}

function verifierToken(token) {
    if (!token) return null
    const [corps, sig] = token.split('.')
    if (!corps || !sig) return null

    const attendu = crypto.createHmac('sha256', SECRET).update(corps).digest('base64url')
    const a = Buffer.from(sig), b = Buffer.from(attendu)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

    try {
        const payload = JSON.parse(Buffer.from(corps, 'base64url').toString())
        return payload.exp > Date.now() ? payload : null
    } catch {
        return null
    }
}

// Authentifie la requête. Le rôle est relu en base à chaque appel :
// un jeton ne doit jamais être la source de vérité sur les droits.
async function authentifier(req, res, next) {
    const entete = req.headers.authorization || ''
    const payload = verifierToken(entete.startsWith('Bearer ') ? entete.slice(7) : null)
    if (!payload) return res.status(401).json({ erreur: 'Session invalide ou expirée' })

    const [rows] = await pool.query(
        'SELECT id, nom, prenom, type, nombreConnexion, mail FROM utilisateurs WHERE id = ?',
        [payload.id]
    )
    if (!rows.length) return res.status(401).json({ erreur: 'Compte introuvable' })

    req.utilisateur = rows[0]
    next()
}

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

;(async () => {
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
    await pool.query(`
        CREATE TABLE IF NOT EXISTS creations (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            titre       VARCHAR(255) NOT NULL,
            description TEXT,
            photo       LONGBLOB
        )
    `)

    // Catégorie : simple libellé porté par la création. Pas de table
    // dédiée — une catégorie existe tant qu'une création s'en réclame,
    // ce qui évite d'avoir à gérer des catégories vides.
    const [colonne] = await pool.query(`
        SELECT COUNT(*) AS presente FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'creations' AND COLUMN_NAME = 'categorie'
    `)
    if (!colonne[0].presente) {
        await pool.query('ALTER TABLE creations ADD COLUMN categorie VARCHAR(100) NULL')
        console.log('Colonne `categorie` ajoutée à la table creations.')
    }

    // Liste déclarée des catégories : elle permet d'en créer une avant
    // qu'aucune création ne s'en réclame. Le libellé reste porté par
    // `creations.categorie` — renommer met les deux à jour.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
            id  INT AUTO_INCREMENT PRIMARY KEY,
            nom VARCHAR(100) NOT NULL UNIQUE
        )
    `)
    // Reprise des libellés déjà utilisés avant l'existence de la table.
    await pool.query(`
        INSERT IGNORE INTO categories (nom)
        SELECT DISTINCT categorie FROM creations
        WHERE categorie IS NOT NULL AND categorie <> ''
    `)

    // Journal des connexions, à la journée : une ligne par personne et
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

    // Une création peut porter plusieurs photos. `ordre` fixe leur
    // succession ; la première (ordre 0) sert de couverture en galerie.
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

    // Reprise des créations d'avant la table `photos` : leur image unique
    // devient leur première photo. `creations.photo` est conservée telle
    // quelle — rien n'est effacé, la migration peut être rejouée sans
    // risque de doublon.
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

    // Crée le compte administrateur au premier démarrage, jamais en dur.
    const [admins] = await pool.query('SELECT id FROM utilisateurs WHERE type = ? LIMIT 1', ['admin'])
    if (!admins.length) {
        const mail = process.env.ADMIN_EMAIL
        const mdp  = process.env.ADMIN_PASSWORD
        if (!mail || !mdp) {
            console.warn('⚠  Aucun administrateur en base. Définissez ADMIN_EMAIL et ADMIN_PASSWORD puis redémarrez.')
        } else {
            const hash = await bcrypt.hash(mdp, 10)
            await pool.query(
                'INSERT INTO utilisateurs (nom, prenom, type, nombreConnexion, mail, Mdp) VALUES (?, ?, ?, ?, ?, ?)',
                [process.env.ADMIN_NOM || 'Admin', process.env.ADMIN_PRENOM || '', 'admin', 0, mail, hash]
            )
            console.log(`Administrateur créé : ${mail}`)
        }
    }
})()

/* ------------------------------------------------------------------ *
 *  Envoi d'emails (réinitialisation de mot de passe)
 * ------------------------------------------------------------------ */

const SMTP_HOST = process.env.SMTP_HOST || ''
const MAIL_MODE = process.env.MAIL_MODE || (SMTP_HOST ? 'smtp' : '')
const SITE_URL  = (process.env.SITE_URL || '').replace(/\/$/, '')
const MAIL_FROM = process.env.SMTP_FROM || 'album@localhost'

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

// Jeton de réinitialisation : signé avec le hash du mot de passe actuel.
// Conséquence utile — dès que le mot de passe change, tous les jetons
// émis auparavant deviennent invalides. Pas de table à gérer.
const DUREE_RESET = 60 * 60 * 1000 // 1 heure

function signerReset(id, hashActuel, exp) {
    const corps = Buffer.from(JSON.stringify({ id, exp })).toString('base64url')
    const sig   = crypto.createHmac('sha256', SECRET + hashActuel).update(corps).digest('base64url')
    return `${corps}.${sig}`
}

async function verifierReset(token) {
    if (!token) return null
    const [corps, sig] = String(token).split('.')
    if (!corps || !sig) return null

    let payload
    try {
        payload = JSON.parse(Buffer.from(corps, 'base64url').toString())
    } catch {
        return null
    }
    if (!payload.exp || payload.exp < Date.now()) return null

    const [rows] = await pool.query('SELECT id, mail, Mdp FROM utilisateurs WHERE id = ?', [payload.id])
    if (!rows.length) return null

    const attendu = crypto.createHmac('sha256', SECRET + rows[0].Mdp).update(corps).digest('base64url')
    const a = Buffer.from(sig), b = Buffer.from(attendu)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

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

function codeValide(fourni) {
    if (!CODE_INVITATION) return true
    const a = Buffer.from(String(fourni || ''))
    const b = Buffer.from(CODE_INVITATION)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Permet au formulaire de savoir s'il doit afficher le champ.
app.get('/api/inscription/config', (req, res) => {
    res.json({ codeRequis: !!CODE_INVITATION })
})

/* ------------------------------------------------------------------ *
 *  Routes publiques
 * ------------------------------------------------------------------ */

app.post('/api/login', async (req, res) => {
    const { email, motDePasse } = req.body
    const [rows] = await pool.query('SELECT * FROM utilisateurs WHERE mail = ?', [email])
    if (!rows.length) return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' })

    const valide = await bcrypt.compare(motDePasse, rows[0].Mdp)
    if (!valide) return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' })

    await pool.query('UPDATE utilisateurs SET nombreConnexion = nombreConnexion + 1 WHERE id = ?', [rows[0].id])
    // INSERT IGNORE : la 2e connexion du jour ne crée pas de doublon.
    await pool.query('INSERT IGNORE INTO connexions (utilisateurId, jour) VALUES (?, CURDATE())', [rows[0].id])

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
        `Bonjour ${prenom},\n\n`
      + `Votre compte vient d'être créé sur l'album de créations couture\n`
      + `de Manuela. Bienvenue !\n\n`
      + `Vous pouvez dès maintenant vous connecter pour parcourir la galerie\n`
      + `et découvrir chaque création en détail${SITE_URL ? ` :\n\n${SITE_URL}/login\n` : '.\n'}\n`
      + `Bonne visite,\n`
      + `— L'album couture\n`
    ).catch(() => {})

    res.json({ success: true })
})

/* ------------------------------------------------------------------ *
 *  Mot de passe oublié
 * ------------------------------------------------------------------ */

app.get('/api/mot-de-passe-oublie/config', (req, res) => {
    res.json({ disponible: !!transport })
})

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
            `Bonjour ${u.prenom},\n\n`
          + `Vous avez demandé à réinitialiser votre mot de passe.\n`
          + `Cliquez sur ce lien, valable une heure :\n\n${lien}\n\n`
          + `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : `
          + `votre mot de passe restera inchangé.\n`
        )
    }
    res.json({ success: true })
})

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

app.get('/api/utilisateurs/:id', authentifier, soiMeme, async (req, res) => {
    const [rows] = await pool.query(
        'SELECT id, nom, prenom, type, nombreConnexion, mail FROM utilisateurs WHERE id = ?',
        [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ erreur: 'Utilisateur non trouvé' })
    res.json(rows[0])
})

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

app.delete('/api/utilisateurs/:id', authentifier, soiMeme, async (req, res) => {
    await pool.query('DELETE FROM utilisateurs WHERE id = ?', [req.params.id])
    res.json({ success: true })
})

/* ------------------------------------------------------------------ *
 *  Photos — lecture pour tout membre connecté, écriture pour l'admin
 * ------------------------------------------------------------------ */

const LIMITE_PHOTOS = 12

// Une catégorie vide vaut « non classée » (NULL) plutôt qu'une chaîne
// vide : sans ça, "" et NULL formeraient deux groupes distincts.
function nettoyerCategorie(valeur) {
    if (typeof valeur !== 'string') return null
    const propre = valeur.trim().slice(0, 100)
    return propre.length ? propre : null
}

// Renvoie l'image décodée en binaire plutôt qu'en base64 : un tiers de
// poids en moins, et le navigateur peut la mettre en cache.
function envoyerImage(res, donnees) {
    const trouve = /^data:([^;]+);base64,(.*)$/s.exec(donnees)
    if (!trouve) return res.status(415).json({ erreur: 'Format d\'image non reconnu' })
    res.set('Content-Type', trouve[1])
    res.set('Cache-Control', 'private, max-age=86400')
    res.send(Buffer.from(trouve[2], 'base64'))
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

// Liste SANS les images : quelques centaines d'octets au lieu de plusieurs
// Mo. La galerie s'affiche aussitôt, chaque vignette se charge ensuite
// pour son compte via /api/photos/:id/image.
app.get('/api/photos', authentifier, async (req, res) => {
    // `?categorie=` filtre la galerie ; « sans » cible les créations
    // qui n'ont pas encore été classées.
    const filtre = req.query.categorie
    let condition = '', params = []
    if (filtre === 'sans') {
        condition = 'WHERE c.categorie IS NULL OR c.categorie = ""'
    } else if (filtre) {
        condition = 'WHERE c.categorie = ?'
        params = [filtre]
    }

    const [rows] = await pool.query(`
        SELECT c.id, c.titre, c.description, c.categorie, COUNT(p.id) AS nbPhotos
        FROM creations c
        LEFT JOIN photos p ON p.creationId = c.id
        ${condition}
        GROUP BY c.id, c.titre, c.description, c.categorie
        ORDER BY c.id
    `, params)
    res.json(rows.map(r => ({ ...r, nbPhotos: Number(r.nbPhotos) })))
})

// Catégories déclarées, avec le nombre de créations de chacune. Une
// catégorie encore vide apparaît donc, avec un compte à zéro.
app.get('/api/categories', authentifier, async (req, res) => {
    const [rows] = await pool.query(`
        SELECT cat.id, cat.nom, COUNT(c.id) AS nombre
        FROM categories cat
        LEFT JOIN creations c ON c.categorie = cat.nom
        GROUP BY cat.id, cat.nom
        ORDER BY cat.nom
    `)
    const [sans] = await pool.query(`
        SELECT COUNT(*) AS nombre FROM creations
        WHERE categorie IS NULL OR categorie = ''
    `)
    res.json({
        categories: rows.map(r => ({ id: r.id, nom: r.nom, nombre: Number(r.nombre) })),
        sansCategorie: Number(sans[0].nombre)
    })
})

app.post('/api/categories', authentifier, adminSeulement, async (req, res) => {
    const nom = nettoyerCategorie(req.body.nom)
    if (!nom) return res.status(400).json({ erreur: 'Le nom est obligatoire' })

    // On renvoie le libellé déjà en base, pas celui saisi : si la
    // différence n'est qu'une casse ou un espace, autant la montrer.
    const [existe] = await pool.query('SELECT nom FROM categories WHERE nom = ?', [nom])
    if (existe.length) {
        return res.status(409).json({ erreur: `La catégorie « ${existe[0].nom} » existe déjà` })
    }

    const [r] = await pool.query('INSERT INTO categories (nom) VALUES (?)', [nom])
    res.json({ id: r.insertId, nom, nombre: 0 })
})

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

app.get('/api/statistiques', authentifier, adminSeulement, async (req, res) => {
    // DATE_FORMAT plutôt que l'objet Date : évite tout décalage de fuseau
    // entre le serveur et le navigateur, qui ferait glisser une visite
    // d'un jour à l'autre.
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
    const [membres] = await pool.query(`
        SELECT u.id, u.prenom, u.nom, u.type, u.nombreConnexion,
               DATE_FORMAT(MAX(cx.jour), '%Y-%m-%d') AS derniereVisite,
               COUNT(cx.id) AS joursDeVisite
        FROM utilisateurs u
        LEFT JOIN connexions cx ON cx.utilisateurId = u.id
        GROUP BY u.id, u.prenom, u.nom, u.type, u.nombreConnexion
        ORDER BY MAX(cx.jour) IS NULL, MAX(cx.jour) DESC
    `)
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
    const [rows] = await pool.query('SELECT photo FROM photos WHERE id = ?', [req.params.imageId])
    if (!rows.length || !rows[0].photo) return res.status(404).end()
    envoyerImage(res, rows[0].photo.toString())
})

// Photo de couverture d'une création (la première dans l'ordre).
app.get('/api/photos/:id/image', authentifier, async (req, res) => {
    const [rows] = await pool.query(
        'SELECT photo FROM photos WHERE creationId = ? ORDER BY ordre, id LIMIT 1',
        [req.params.id]
    )
    if (!rows.length || !rows[0].photo) return res.status(404).end()
    envoyerImage(res, rows[0].photo.toString())
})

// Détail d'une création : ses métadonnées et la liste de ses photos,
// sous forme d'identifiants seulement — chacune est ensuite chargée
// séparément par la page.
app.get('/api/photos/:id', authentifier, async (req, res) => {
    const [rows] = await pool.query('SELECT id, titre, description, categorie FROM creations WHERE id = ?', [req.params.id])
    if (!rows.length) return res.status(404).json({ erreur: 'Non trouvé' })

    const [images] = await pool.query(
        'SELECT id, ordre FROM photos WHERE creationId = ? ORDER BY ordre, id',
        [req.params.id]
    )
    res.json({ ...rows[0], images })
})

app.post('/api/photos', authentifier, adminSeulement, async (req, res) => {
    const { titre, description } = req.body
    if (!titre) return res.status(400).json({ erreur: 'Le titre est obligatoire' })

    const images = normaliserImages(req.body)
    if (!images.length) return res.status(400).json({ erreur: 'Au moins une photo est requise' })

    const [result] = await pool.query(
        'INSERT INTO creations (titre, description, categorie, photo) VALUES (?, ?, ?, ?)',
        [titre, description || '', nettoyerCategorie(req.body.categorie), images[0]]
    )
    for (const [i, img] of images.entries()) {
        await pool.query('INSERT INTO photos (creationId, ordre, photo) VALUES (?, ?, ?)', [result.insertId, i, img])
    }
    res.json({ id: result.insertId, titre, description, nbPhotos: images.length })
})

app.put('/api/photos/:id', authentifier, adminSeulement, async (req, res) => {
    const { titre, description } = req.body
    await pool.query(
        'UPDATE creations SET titre = ?, description = ?, categorie = ? WHERE id = ?',
        [titre, description || '', nettoyerCategorie(req.body.categorie), req.params.id]
    )

    // `photos` absent du corps : seuls le titre et la description changent,
    // les images restent en place.
    if (req.body.photos === undefined && req.body.photo === undefined) {
        return res.json({ success: true })
    }

    const images = normaliserImages(req.body)
    if (!images.length) return res.status(400).json({ erreur: 'Au moins une photo est requise' })

    // Les entrées « conserver:<id> » désignent des photos déjà stockées :
    // on ne les retéléverse pas, on se contente de les renuméroter.
    const aGarder = images.filter(v => v.startsWith('conserver:')).map(v => Number(v.slice(10)))
    if (aGarder.length) {
        await pool.query(
            `DELETE FROM photos WHERE creationId = ? AND id NOT IN (${aGarder.map(() => '?').join(',')})`,
            [req.params.id, ...aGarder]
        )
    } else {
        await pool.query('DELETE FROM photos WHERE creationId = ?', [req.params.id])
    }

    for (const [i, valeur] of images.entries()) {
        if (valeur.startsWith('conserver:')) {
            await pool.query('UPDATE photos SET ordre = ? WHERE id = ? AND creationId = ?',
                [i, Number(valeur.slice(10)), req.params.id])
        } else {
            await pool.query('INSERT INTO photos (creationId, ordre, photo) VALUES (?, ?, ?)',
                [req.params.id, i, valeur])
        }
    }

    // La colonne historique suit la couverture, pour rester cohérente.
    const [couv] = await pool.query(
        'SELECT photo FROM photos WHERE creationId = ? ORDER BY ordre, id LIMIT 1', [req.params.id])
    await pool.query('UPDATE creations SET photo = ? WHERE id = ?',
        [couv.length ? couv[0].photo : null, req.params.id])

    res.json({ success: true })
})

app.delete('/api/photos/:id', authentifier, adminSeulement, async (req, res) => {
    await pool.query('DELETE FROM creations WHERE id = ?', [req.params.id])
    res.json({ success: true })
})

/* ------------------------------------------------------------------ *
 *  Front Vue (build de production)
 * ------------------------------------------------------------------ */

app.use(express.static(path.join(__dirname, 'album', 'dist')))
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'album', 'dist', 'index.html'))
})

app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`))
