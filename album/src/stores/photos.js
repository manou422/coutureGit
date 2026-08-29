// ===================================================================
//  stores/photos.js — la liste des créations
// ===================================================================
//
//  Deuxième store, plus petit : il ne contient que la liste affichée par
//  la galerie, et les trois opérations qui la modifient. Les images n'y
//  sont pas — le serveur ne renvoie que titres et compteurs, chaque
//  vignette se chargeant ensuite pour son compte (voir PhotoCard.vue).
import { ref } from 'vue'
import { api } from './auth.js'

export const photos = ref([])  // la liste, partagée par tous les écrans


// Remplit la liste. Avec une catégorie, le serveur ne renvoie que
// celle-ci ; `encodeURIComponent` protège les libellés contenant un
// espace ou un accent.
export async function chargerPhotos(categorie = null) {
    const url = categorie
        ? `/api/photos?categorie=${encodeURIComponent(categorie)}`
        : '/api/photos'
    const res = await api(url)
    if (res.ok) photos.value = await res.json()
}


// Envoie une nouvelle création. En cas de refus, on relève le message
// du serveur dans une erreur, que le formulaire attrape et affiche.
export async function ajouterPhoto(creation) {
    const res = await api('/api/photos', {
        method: 'POST',
        body:   JSON.stringify(creation)
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur || "Impossible d'ajouter la création")
    }
    // La création est ajoutée à la liste locale : la galerie se met à jour
    // sans avoir à tout recharger.
    photos.value.push(await res.json())
}


// Supprime une création, puis la retire de la liste locale.
export async function supprimerPhoto(id) {
    const res = await api(`/api/photos/${id}`, { method: 'DELETE' })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur || 'Suppression refusée')
    }
    // On cherche sa position, puis on la retire (`splice`) : la carte disparaît aussitôt.
    const index = photos.value.findIndex(p => p.id === id)
    if (index !== -1) photos.value.splice(index, 1)
}
