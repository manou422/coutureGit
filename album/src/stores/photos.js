import { ref } from 'vue'

export const photos = ref([])

export async function chargerPhotos() {
    const res  = await fetch('/api/photos')
    photos.value = await res.json()
}

export async function ajouterPhoto(photo) {
    const res  = await fetch('/api/photos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(photo)
    })
    const nouvelle = await res.json()
    photos.value.push(nouvelle)
}

export async function supprimerPhoto(id) {
    await fetch(`/api/photos/${id}`, { method: 'DELETE' })
    const index = photos.value.findIndex(p => p.id === id)
    if (index !== -1) photos.value.splice(index, 1)
}
