// ===================================================================
//  stores/auth.js — la mémoire partagée du site
// ===================================================================
//
//  Un « store » est un fichier de données communes : tout écran qui
//  l'importe voit les mêmes valeurs, et se redessine tout seul quand
//  elles changent. On y trouve ici :
//
//    - qui est connecté (`utilisateur`, `token`) et les fonctions pour
//      ouvrir/fermer une session ;
//    - `api()`, par laquelle passent TOUS les appels au serveur ;
//    - la liste des catégories, partagée entre le menu et les
//      formulaires ;
//    - le chargement des images, qui demande un détour (voir plus bas).
//
//  Deux outils de Vue sont utilisés :
//    ref(x)       une valeur « surveillée ». On la lit et on l'écrit
//                 avec .value ; l'affichage suit automatiquement.
//    computed(fn) une valeur calculée à partir d'autres refs, recalculée
//                 seule dès que l'une d'elles bouge.
import { ref, computed } from 'vue'


// Relit le profil rangé dans le navigateur (localStorage) au chargement
// de la page : sans cela, un simple F5 déconnecterait. Le try/catch
// protège du cas où la valeur stockée serait abîmée.
function lireLocal() {
    try {
        const brut = localStorage.getItem('utilisateur')
        return brut ? JSON.parse(brut) : null
    } catch {
        return null
    }
}

export const utilisateur = ref(lireLocal())  // profil du connecté, ou null
export const token       = ref(localStorage.getItem('token'))  // jeton à joindre aux appels
export const estAdmin    = computed(() => utilisateur.value?.type === 'admin')  // affichage seulement : le serveur revalide
export const estConnecte = computed(() => !!utilisateur.value && !!token.value)


// Enregistre une session. Appelée à la connexion (avec un jeton), mais
// aussi après une modification de profil (sans jeton : on ne fait alors
// que rafraîchir les informations affichées).
export function connecter(donnees, nouveauToken) {
    utilisateur.value = donnees
    localStorage.setItem('connecte', 'true')
    localStorage.setItem('utilisateur', JSON.stringify(donnees))
    if (nouveauToken) {
        token.value = nouveauToken
        localStorage.setItem('token', nouveauToken)
    }
}


// Efface tout, en mémoire et dans le navigateur.
export function deconnecter() {
    utilisateur.value = null
    token.value       = null
    localStorage.removeItem('connecte')
    localStorage.removeItem('utilisateur')
    localStorage.removeItem('token')
}

// Appel API authentifié. Une session expirée ou invalide (401) déconnecte
// proprement plutôt que de laisser l'interface dans un état incohérent.
export async function api(url, options = {}) {
    // On recopie les en-têtes demandés, puis on ajoute le jeton et, quand il
    // y a un corps à envoyer, le type JSON.
    const entetes = { ...(options.headers || {}) }
    if (token.value) entetes.Authorization = `Bearer ${token.value}`
    if (options.body && !entetes['Content-Type']) entetes['Content-Type'] = 'application/json'

    const res = await fetch(url, { ...options, headers: entetes })
    if (res.status === 401) {
        deconnecter()
        throw new Error('Session expirée')
    }
    return res
}

// Liste des catégories, partagée par la barre de navigation, la page
// « Toutes les catégories » et les deux formulaires (qui proposent les
// libellés déjà existants).
export const categories    = ref([])
export const sansCategorie = ref(0)


// Recharge la liste depuis le serveur. Appelée à chaque changement de
// page : une création ajoutée ou supprimée change les compteurs.
export async function chargerCategories() {
    if (!token.value) return
    try {
        const res = await api('/api/categories')
        if (!res.ok) return
        const data = await res.json()
        categories.value    = data.categories
        sansCategorie.value = data.sansCategorie
    } catch {
        // Réseau indisponible : on garde la liste précédente.
    }
}

// Masque une catégorie aux membres, ou la remontre. Réservé à
// l'administratrice : le serveur refuse l'appel aux autres.
export async function basculerVisibilite(id, visible) {
    const res = await api(`/api/categories/${id}/visibilite`, {
        method: 'PATCH',
        body:   JSON.stringify({ visible })
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur || 'Changement de visibilité impossible')
    }
    await chargerCategories()
}


// Récupère la photo de couverture d'une création.
//
// Pourquoi un détour ? Une balise <img src="..."> ne sait pas joindre
// l'en-tête d'authentification. On télécharge donc l'image avec fetch
// (qui, lui, passe par api() et son jeton), puis on fabrique une adresse
// locale et temporaire — un « blob » — que <img> saura afficher.
export async function urlImage(id) {
    return chargerBlob(`/api/photos/${id}/image`)
}

// Même chose pour une photo précise, désignée par son identifiant propre.
export async function urlPhoto(imageId) {
    return chargerBlob(`/api/images/${imageId}`)
}


// Le détour lui-même. Renvoie null en cas d'échec : les écrans savent
// afficher un rectangle d'attente à la place.
//
// Important : chaque adresse créée ici occupe de la mémoire jusqu'à
// URL.revokeObjectURL(). Les composants qui appellent ces fonctions le
// font donc en quittant la page (onUnmounted).
async function chargerBlob(url) {
    try {
        const res = await api(url)
        if (!res.ok) return null
        return URL.createObjectURL(await res.blob())
    } catch {
        return null
    }
}

// Le localStorage n'est qu'un cache : le rôle fait autorité côté serveur.
let resynchronise = false  // la resynchro n'a lieu qu'une fois par chargement de page


// Redemande le profil au serveur et le range. Sert à deux choses : voir
// un rôle qui a changé, et vérifier que la session tient toujours.
export async function rafraichir() {
    const id = utilisateur.value?.id
    if (!id || !token.value) {
        deconnecter()
        return null
    }
    try {
        const res = await api(`/api/utilisateurs/${id}`)
        if (!res.ok) {
            deconnecter()
            return null
        }
        connecter(await res.json())
        return utilisateur.value
    } catch {
        // Session expirée (déjà déconnectée par api) ou serveur injoignable
        return utilisateur.value
    }
}


// Appelée par la garde du routeur avant chaque page protégée, mais ne
// travaille qu'au premier appel : sans ce verrou, chaque navigation
// déclencherait un aller-retour réseau inutile.
export async function assurerSynchro() {
    if (resynchronise) return utilisateur.value
    resynchronise = true
    return rafraichir()
}


// Réarme le verrou après une connexion : le nouveau profil doit être relu.
export function invaliderSynchro() {
    resynchronise = false
}
