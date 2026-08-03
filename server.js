const express  = require('express')
const cors     = require('cors')
const mysql    = require('mysql2/promise')
const bcrypt   = require('bcryptjs')
const crypto   = require('crypto')
const path     = require('path')

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

app.get('/api/photos', authentifier, async (req, res) => {
    const [rows] = await pool.query('SELECT id, titre, description, photo FROM creations')
    res.json(rows.map(row => ({
        id:          row.id,
        titre:       row.titre,
        description: row.description,
        photo:       row.photo ? row.photo.toString() : null
    })))
})

app.get('/api/photos/:id', authentifier, async (req, res) => {
    const [rows] = await pool.query('SELECT id, titre, description, photo FROM creations WHERE id = ?', [req.params.id])
    if (!rows.length) return res.status(404).json({ erreur: 'Non trouvé' })
    const row = rows[0]
    res.json({
        id:          row.id,
        titre:       row.titre,
        description: row.description,
        photo:       row.photo ? row.photo.toString() : null
    })
})

app.post('/api/photos', authentifier, adminSeulement, async (req, res) => {
    const { titre, description, photo } = req.body
    if (!titre) return res.status(400).json({ erreur: 'Le titre est obligatoire' })
    const [result] = await pool.query(
        'INSERT INTO creations (titre, description, photo) VALUES (?, ?, ?)',
        [titre, description || '', photo || null]
    )
    res.json({ id: result.insertId, titre, description, photo })
})

app.put('/api/photos/:id', authentifier, adminSeulement, async (req, res) => {
    const { titre, description, photo } = req.body
    await pool.query(
        'UPDATE creations SET titre = ?, description = ?, photo = ? WHERE id = ?',
        [titre, description || '', photo || null, req.params.id]
    )
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
