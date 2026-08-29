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


// Étape 3 : redessine l'image dans un canvas invisible, à la largeur
// voulue. La hauteur suit la même proportion, pour ne pas déformer la
// photo. Renvoie la nouvelle data URL.
function redessiner(image, largeurVoulue, typeVoulu) {
    const proportion = largeurVoulue / image.width

    const canvas  = document.createElement('canvas')
    canvas.width  = largeurVoulue
    canvas.height = Math.round(image.height * proportion)

    const pinceau = canvas.getContext('2d')
    pinceau.imageSmoothingQuality = 'high'
    pinceau.drawImage(image, 0, 0, canvas.width, canvas.height)

    return canvas.toDataURL(typeVoulu, QUALITE)
}


// Réduit une photo choisie dans le formulaire et renvoie une « data URL »
// (une chaîne data:image/jpeg;base64,... que le serveur range telle
// quelle en base).
export async function redimensionner(fichier, largeurMax = LARGEUR_MAX) {
    const original = await lireFichier(fichier)
    const image    = await chargerImage(original)

    // Déjà assez petite : on garde l'original, sans le recompresser.
    if (image.width <= largeurMax) return original

    // Le PNG est conservé s'il l'était (pour sa transparence), sinon JPEG.
    const type = fichier.type === 'image/png' ? 'image/png' : 'image/jpeg'
    return redessiner(image, largeurMax, type)
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
