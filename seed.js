const mysql = require('mysql2/promise')
const fs    = require('fs')
const path  = require('path')

const PHOTOS_DIR = path.join(__dirname, 'album', 'public', 'photos')

const albums = [
    { titre: 'Pochon 1',     description: '', fichier: 'pochon1.JPEG' },
    { titre: 'Pochette ZIP', description: '', fichier: 'pochetteZip.JPEG' },
    { titre: 'Couture',      description: '', fichier: 'couture.webp' }
]

async function seed() {
    const pool = mysql.createPool({
        host:     process.env.DB_HOST     || 'localhost',
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        port:     parseInt(process.env.DB_PORT) || 3306
    })

    await pool.query('CREATE DATABASE IF NOT EXISTS album')
    await pool.query('USE album')
    await pool.query(`
        CREATE TABLE IF NOT EXISTS creations (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            titre       VARCHAR(255) NOT NULL,
            description TEXT,
            photo       LONGBLOB
        )
    `)

    for (const album of albums) {
        const filePath = path.join(PHOTOS_DIR, album.fichier)
        if (!fs.existsSync(filePath)) {
            console.log(`Fichier introuvable : ${album.fichier}`)
            continue
        }
        const buffer = fs.readFileSync(filePath)
        const ext    = path.extname(album.fichier).toLowerCase()
        const mime   = ext === '.webp' ? 'image/webp' : 'image/jpeg'
        const base64 = `data:${mime};base64,${buffer.toString('base64')}`
        await pool.query(
            'INSERT INTO creations (titre, description, photo) VALUES (?, ?, ?)',
            [album.titre, album.description, base64]
        )
        console.log(`✓ ${album.titre} ajouté`)
    }

    await pool.end()
    console.log('Seed terminé.')
}

seed().catch(console.error)
