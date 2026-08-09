// Réduit une photo avant l'envoi. Une photo de téléphone fait 4 à 6 Mo,
// pour une largeur de 4000 px que le site n'utilise jamais : 1600 px
// suffisent pour l'affichage plein écran, et le poids tombe d'un facteur
// dix à vingt. La base et le forfait mobile des visiteurs y gagnent autant.
const LARGEUR_MAX = 1600
const QUALITE     = 0.85

export function redimensionner(fichier, largeurMax = LARGEUR_MAX) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader()
        lecteur.onerror = () => reject(new Error('Lecture du fichier impossible'))
        lecteur.onload = () => {
            const img = new Image()
            img.onerror = () => reject(new Error('Fichier image illisible'))
            img.onload = () => {
                // Déjà assez petite : on garde l'original, sans recompresser.
                if (img.width <= largeurMax) return resolve(lecteur.result)

                const ratio  = largeurMax / img.width
                const canvas = document.createElement('canvas')
                canvas.width  = largeurMax
                canvas.height = Math.round(img.height * ratio)

                const ctx = canvas.getContext('2d')
                ctx.imageSmoothingQuality = 'high'
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

                // Le PNG est conservé s'il l'était (transparence), sinon JPEG.
                const type = fichier.type === 'image/png' ? 'image/png' : 'image/jpeg'
                resolve(canvas.toDataURL(type, QUALITE))
            }
            img.src = lecteur.result
        }
        lecteur.readAsDataURL(fichier)
    })
}

export function poidsLisible(dataUrl) {
    if (!dataUrl) return '0 Ko'
    const octets = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75)
    return octets >= 1048576
        ? `${(octets / 1048576).toFixed(1)} Mo`
        : `${Math.round(octets / 1024)} Ko`
}
