// ===================================================================
//  seed.js — remplissage de départ (« seed » = graine)
// ===================================================================
//
//  Script à lancer une seule fois, à la main : npm run seed
//  Il crée la base et y dépose trois créations d'exemple à partir des
//  photos rangées dans album/public/photos/.
//
//  Il n'est pas utilisé par le site : c'est un outil de mise en route,
//  pratique pour avoir quelque chose à regarder sur une base vide.
const mysql = require('mysql2/promise')
const fs    = require('fs')
const path  = require('path')

const PHOTOS_DIR = path.join(__dirname, 'album', 'public', 'photos')

// Les créations à insérer. `fichier` désigne une image du dossier photos.
const albums = [
    { titre: 'Pochon 1',     description: '', fichier: 'pochon1.JPEG' },
    { titre: 'Pochette ZIP', description: '', fichier: 'pochetteZip.JPEG' },
    { titre: 'Couture',      description: '', fichier: 'couture.webp' }
]


// Tout le travail tient dans cette fonction, appelée tout en bas.
// Elle est `async` parce que chaque appel à la base est asynchrone : le
// programme attend la réponse (`await`) avant de continuer.
async function seed() {
    const pool = mysql.createPool({
        host:     process.env.DB_HOST     || 'localhost',
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        port:     parseInt(process.env.DB_PORT) || 3306
    })

    // Contrairement au serveur, on se connecte ici sans nom de base : il
    // faut pouvoir la créer si elle manque, puis se placer dedans.
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

    // Chaque image est lue sur le disque puis insérée en base.
    for (const album of albums) {
        const filePath = path.join(PHOTOS_DIR, album.fichier)
        if (!fs.existsSync(filePath)) {
            console.log(`Fichier introuvable : ${album.fichier}`)
            continue
        }
        // Lecture du fichier en binaire, puis conversion en « data URL » : c'est
        // le format que le site attend (data:image/jpeg;base64,...), le même que
        // celui produit par le navigateur au moment de téléverser une photo.
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

    // Referme les connexions, sinon le script resterait bloqué à la fin.
    await pool.end()
    console.log('Seed terminé.')
}

// Lance le script ; toute erreur est affichée plutôt que d'être avalée.
seed().catch(console.error)
