const express  = require('express')
const cors     = require('cors')
const mysql    = require('mysql2/promise')
const bcrypt   = require('bcryptjs')
const fs       = require('fs')
const path     = require('path')

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '50mb' }))

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '12Couture422§',
    database: process.env.DB_NAME     || 'album',
    port:     parseInt(process.env.DB_PORT) || 3306
})

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
    const [rows] = await pool.query('SELECT id FROM utilisateurs WHERE id = 1')
    if (!rows.length) {
        const hash = await bcrypt.hash('Manou422', 10)
        await pool.query(
            'INSERT INTO utilisateurs (id, nom, prenom, type, nombreConnexion, mail, Mdp) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [1, 'ORTIZ', 'Manuela', 'admin', 0, 'manou422@icloud.com', hash]
        )
        console.log('Utilisateur admin créé : manou422@icloud.com / Manou422')
    }
})()

// POST connexion
app.post('/api/login', async (req, res) => {
    const { email, motDePasse } = req.body
    const [rows] = await pool.query('SELECT * FROM utilisateurs WHERE mail = ?', [email])
    if (!rows.length) return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' })
    const valide = await bcrypt.compare(motDePasse, rows[0].Mdp)
    if (!valide) return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' })
    await pool.query('UPDATE utilisateurs SET nombreConnexion = nombreConnexion + 1 WHERE id = ?', [rows[0].id])
    res.json({ utilisateur: { id: rows[0].id, mail: rows[0].mail, nom: rows[0].nom, prenom: rows[0].prenom, type: rows[0].type } })
})

// POST inscription
app.post('/api/inscription', async (req, res) => {
    const { nom, prenom, mail, motDePasse } = req.body
    if (!nom || !prenom || !mail || !motDePasse) {
        return res.status(400).json({ erreur: 'Tous les champs sont obligatoires' })
    }
    const [existing] = await pool.query('SELECT id FROM utilisateurs WHERE mail = ?', [mail])
    if (existing.length) return res.status(409).json({ erreur: 'Cet email est déjà utilisé' })
    const hash = await bcrypt.hash(motDePasse, 10)
    await pool.query(
        'INSERT INTO utilisateurs (nom, prenom, type, nombreConnexion, mail, Mdp) VALUES (?, ?, ?, ?, ?, ?)',
        [nom, prenom, 'PA', 0, mail, hash]
    )
    res.json({ success: true })
})

// GET un utilisateur par id
app.get('/api/utilisateurs/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT id, nom, prenom, type, nombreConnexion, mail FROM utilisateurs WHERE id = ?', [req.params.id])
    if (!rows.length) return res.status(404).json({ erreur: 'Utilisateur non trouvé' })
    res.json(rows[0])
})

// PUT modifier un utilisateur
app.put('/api/utilisateurs/:id', async (req, res) => {
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

// DELETE supprimer un utilisateur
app.delete('/api/utilisateurs/:id', async (req, res) => {
    await pool.query('DELETE FROM utilisateurs WHERE id = ?', [req.params.id])
    res.json({ success: true })
})

// GET toutes les photos
app.get('/api/photos', async (req, res) => {
    const [rows] = await pool.query('SELECT id, titre, description, photo FROM creations')
    const photos = rows.map(row => ({
        id:          row.id,
        titre:       row.titre,
        description: row.description,
        photo:       row.photo ? row.photo.toString() : null
    }))
    res.json(photos)
})

// GET une photo par id
app.get('/api/photos/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT id, titre, description, photo FROM creations WHERE id = ?', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Non trouvé' })
    const row = rows[0]
    res.json({
        id:          row.id,
        titre:       row.titre,
        description: row.description,
        photo:       row.photo ? row.photo.toString() : null
    })
})

// POST ajouter une photo
app.post('/api/photos', async (req, res) => {
    const { titre, description, photo } = req.body
    const [result] = await pool.query(
        'INSERT INTO creations (titre, description, photo) VALUES (?, ?, ?)',
        [titre, description || '', photo || null]
    )
    res.json({ id: result.insertId, titre, description, photo })
})

// PUT modifier une photo
app.put('/api/photos/:id', async (req, res) => {
    const { titre, description, photo } = req.body
    await pool.query(
        'UPDATE creations SET titre = ?, description = ?, photo = ? WHERE id = ?',
        [titre, description || '', photo || null, req.params.id]
    )
    res.json({ success: true })
})

// DELETE supprimer une photo
app.delete('/api/photos/:id', async (req, res) => {
    await pool.query('DELETE FROM creations WHERE id = ?', [req.params.id])
    res.json({ success: true })
})

// Servir le build Vue en production
app.use(express.static(path.join(__dirname, 'album', 'dist')))
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'album', 'dist', 'index.html'))
})

app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`))
