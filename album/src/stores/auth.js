import { ref, computed } from 'vue'

function lireLocal() {
    try {
        const brut = localStorage.getItem('utilisateur')
        return brut ? JSON.parse(brut) : null
    } catch {
        return null
    }
}

export const utilisateur = ref(lireLocal())
export const token       = ref(localStorage.getItem('token'))
export const estAdmin    = computed(() => utilisateur.value?.type === 'admin')
export const estConnecte = computed(() => !!utilisateur.value && !!token.value)

export function connecter(donnees, nouveauToken) {
    utilisateur.value = donnees
    localStorage.setItem('connecte', 'true')
    localStorage.setItem('utilisateur', JSON.stringify(donnees))
    if (nouveauToken) {
        token.value = nouveauToken
        localStorage.setItem('token', nouveauToken)
    }
}

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

// Récupère l'image d'une création. Les balises <img> ne peuvent pas
// porter d'en-tête d'authentification : on passe donc par fetch, puis
// par une URL d'objet locale.
export async function urlImage(id) {
    return chargerBlob(`/api/photos/${id}/image`)
}

// Une photo précise, par son identifiant propre.
export async function urlPhoto(imageId) {
    return chargerBlob(`/api/images/${imageId}`)
}

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
let resynchronise = false

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

export async function assurerSynchro() {
    if (resynchronise) return utilisateur.value
    resynchronise = true
    return rafraichir()
}

export function invaliderSynchro() {
    resynchronise = false
}
