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
export const estAdmin    = computed(() => utilisateur.value?.type === 'admin')
export const estConnecte = computed(() => !!utilisateur.value)

export function connecter(donnees) {
    utilisateur.value = donnees
    localStorage.setItem('connecte', 'true')
    localStorage.setItem('utilisateur', JSON.stringify(donnees))
}

export function deconnecter() {
    utilisateur.value = null
    localStorage.removeItem('connecte')
    localStorage.removeItem('utilisateur')
}

// Le localStorage n'est qu'un cache : le rôle fait autorité côté serveur.
// Sans cette resynchronisation, une session ouverte par une version
// antérieure de l'app reste connectée avec un profil périmé (sans `type`),
// et un vrai admin se retrouve privé des pages admin.
let resynchronise = false

export async function rafraichir() {
    const id = utilisateur.value?.id
    if (!id) {
        deconnecter()
        return null
    }
    try {
        const res = await fetch(`/api/utilisateurs/${id}`)
        if (!res.ok) {
            // 404 : le compte a été supprimé entre-temps
            deconnecter()
            return null
        }
        connecter(await res.json())
        return utilisateur.value
    } catch {
        // Serveur injoignable : on garde le cache plutôt que de déconnecter
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
