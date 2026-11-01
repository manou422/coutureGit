// ===================================================================
//  utils/image.js — préparation des photos avant envoi
// ===================================================================
//
// Réduit une photo avant l'envoi. Une photo de téléphone fait 4 à 6 Mo,
// pour une largeur de 4000 px que le site n'utilise jamais : 1600 px
// suffisent pour l'affichage plein écran, et le poids tombe d'un facteur
// dix à vingt. La base et le forfait mobile des visiteurs y gagnent autant.
//
// Ce travail est fait par le navigateur, avant l'envoi : le serveur ne
// reçoit donc jamais les 6 Mo d'origine.
const LARGEUR_MAX = 1600   // largeur maximale conservée, en pixels
const QUALITE     = 0.85  // compression JPEG : 0 = très compressé, 1 = sans perte


/* --- Les trois étapes ------------------------------------------------ *
 *
 * Réduire une photo demande trois opérations, dont deux sont asynchrones :
 *
 *   1. lire le fichier choisi                    (asynchrone)
 *   2. le décoder en image, pour ses dimensions  (asynchrone)
 *   3. le redessiner en plus petit               (immédiat)
 *
 * Les deux premières reposent sur de vieilles interfaces du navigateur,
 * qui préviennent par des fonctions de rappel (`onload`, `onerror`) au
 * lieu de renvoyer une promesse. On les enveloppe donc chacune dans une
 * petite fonction qui, elle, en renvoie une — ce qui permet ensuite
 * d'écrire l'enchaînement en trois lignes lisibles, avec `await`.
 */

// Étape 1 : lit le fichier et le renvoie en « data URL ».
function lireFichier(fichier) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader()
        lecteur.onload  = () => resolve(lecteur.result)
        lecteur.onerror = () => reject(new Error('Lecture du fichier impossible'))
        lecteur.readAsDataURL(fichier)
    })
}


// Étape 2 : décode la data URL en image. C'est ce décodage qui donne
// accès aux dimensions réelles de la photo.
function chargerImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload  = () => resolve(image)
        image.onerror = () => reject(new Error('Fichier image illisible'))
        image.src = dataUrl
    })
}


// Étape 3 : redessine l'image dans un canvas invisible, aux dimensions
// voulues. Renvoie la nouvelle data URL.
function redessiner(image, largeur, hauteur, typeVoulu) {
    const canvas  = document.createElement('canvas')
    canvas.width  = largeur
    canvas.height = hauteur

    const pinceau = canvas.getContext('2d')
    pinceau.imageSmoothingQuality = 'high'
    pinceau.drawImage(image, 0, 0, largeur, hauteur)

    return canvas.toDataURL(typeVoulu, QUALITE)
}


/* --- L'orientation --------------------------------------------------- *
 *
 * Un téléphone tenu verticalement n'enregistre pas des pixels verticaux :
 * il garde ceux du capteur, couchés, et joint une étiquette EXIF qui dit
 * « à afficher pivotée d'un quart de tour ». Les visionneuses la
 * respectent, mais tout ce qui lit les pixels bruts l'ignore — et la
 * photo part en travers.
 *
 * On ne range donc jamais cette étiquette en base : la rotation est
 * appliquée aux pixels une fois pour toutes, à l'envoi. L'image stockée
 * est alors à l'endroit pour tout le monde, sans dépendre d'une consigne
 * que le prochain lecteur pourrait ignorer.
 *
 * `createImageBitmap` fait ce travail quand on le lui demande : il rend
 * une image déjà redressée, dont la largeur et la hauteur sont celles
 * qu'on voit à l'écran.
 */
async function imageRedressee(fichier) {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(fichier, { imageOrientation: 'from-image' })
        } catch {
            // Navigateur qui connaît `createImageBitmap` mais pas cette
            // option : on retombe sur la voie classique ci-dessous, où
            // c'est le navigateur qui redresse en chargeant l'image.
        }
    }
    return chargerImage(await lireFichier(fichier))
}


// Prépare une photo choisie dans le formulaire et renvoie une « data URL »
// (une chaîne data:image/jpeg;base64,... que le serveur range telle
// quelle en base).
//
// Toute photo repasse par le canvas, même déjà petite. On y perd une
// recompression, on y gagne une image sans étiquette d'orientation : ce
// qui est stocké est ce qui s'affichera, partout et pour toujours.
export async function redimensionner(fichier, largeurMax = LARGEUR_MAX) {
    const image = await imageRedressee(fichier)

    // La largeur retenue est celle de la photo, sans dépasser le plafond.
    // La hauteur suit la même proportion, pour ne pas la déformer — et
    // une photo large reste large, une photo haute reste haute.
    const largeur = Math.min(image.width, largeurMax)
    const hauteur = Math.round(image.height * (largeur / image.width))

    // Le PNG est conservé s'il l'était (pour sa transparence), sinon JPEG.
    const type = fichier.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const reduite = redessiner(image, largeur, hauteur, type)

    // Un bitmap garde ses pixels en mémoire tant qu'on ne le ferme pas.
    // Douze photos de 4000 px en retiendraient beaucoup pour rien.
    if (typeof image.close === 'function') image.close()

    return reduite
}


// Traduit la taille d'une data URL en « 320 Ko » ou « 1,2 Mo », pour
// l'afficher sous le formulaire.
//
// Le calcul : le base64 code 3 octets sur 4 caractères, le poids réel
// vaut donc environ 75 % de la longueur de la chaîne, une fois retiré
// l'en-tête qui précède la virgule.
export function poidsLisible(dataUrl) {
    if (!dataUrl) return '0 Ko'
    const octets = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75)
    return octets >= 1048576
        ? `${(octets / 1048576).toFixed(1)} Mo`
        : `${Math.round(octets / 1024)} Ko`
}
