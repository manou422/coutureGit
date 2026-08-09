import { ref } from 'vue'
import { api } from './auth.js'

export const photos = ref([])

export async function chargerPhotos(categorie = null) {
    const url = categorie
        ? `/api/photos?categorie=${encodeURIComponent(categorie)}`
        : '/api/photos'
    const res = await api(url)
    if (res.ok) photos.value = await res.json()
}

export async function ajouterPhoto(creation) {
    const res = await api('/api/photos', {
        method: 'POST',
        body:   JSON.stringify(creation)
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur || "Impossible d'ajouter la création")
    }
    photos.value.push(await res.json())
}

export async function supprimerPhoto(id) {
    const res = await api(`/api/photos/${id}`, { method: 'DELETE' })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur || 'Suppression refusée')
    }
    const index = photos.value.findIndex(p => p.id === id)
    if (index !== -1) photos.value.splice(index, 1)
}
