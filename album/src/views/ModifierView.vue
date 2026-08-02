<template>
    <div class="modifier">
        <h1>Modifier la création</h1>

        <form v-if="photo" @submit.prevent="sauvegarder" class="formulaire">
            <div class="champ">
                <label>Titre</label>
                <input v-model="titre" type="text" required />
            </div>

            <div class="champ">
                <label>Description</label>
                <textarea v-model="description" rows="4"></textarea>
            </div>

            <div class="champ">
                <label>Photo actuelle</label>
                <img :src="apercu" class="apercu" alt="aperçu" />
            </div>

            <div class="champ">
                <label>Changer la photo (optionnel)</label>
                <input type="file" accept="image/*" @change="chargerFichier" />
            </div>

            <button type="submit">Enregistrer</button>
            <p v-if="erreur" class="erreur">{{ erreur }}</p>
            <p v-if="succes" class="succes">Modifications enregistrées !</p>
        </form>

        <p v-else>Chargement...</p>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../stores/auth.js'

const route  = useRoute()
const router = useRouter()

const photo       = ref(null)
const titre       = ref('')
const description = ref('')
const apercu      = ref(null)
const succes      = ref(false)
const erreur      = ref('')
let   nouvellephoto = null

onMounted(async () => {
    const res  = await api(`/api/photos/${route.params.id}`)
    photo.value = await res.json()
    titre.value       = photo.value.titre
    description.value = photo.value.description
    apercu.value      = photo.value.photo
})

function chargerFichier(e) {
    const fichier = e.target.files[0]
    if (!fichier) return
    const reader = new FileReader()
    reader.onload = () => {
        apercu.value   = reader.result
        nouvellephoto  = reader.result
    }
    reader.readAsDataURL(fichier)
}

async function sauvegarder() {
    const res = await api(`/api/photos/${route.params.id}`, {
        method: 'PUT',
        body:   JSON.stringify({
            titre:       titre.value,
            description: description.value,
            photo:       nouvellephoto || photo.value.photo
        })
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        erreur.value = data.erreur || 'Modification refusée'
        return
    }
    succes.value = true
    setTimeout(() => router.push('/galerie'), 1200)
}
</script>

<style scoped>
.modifier {
    padding: 90px 20px 40px;
    min-height: 100vh;
    font-family: Arial, sans-serif;
    background-color: #f4f4f4;
    display: flex;
    flex-direction: column;
    align-items: center;
}
h1 {
    margin-bottom: 32px;
    color: #333;
    font-size: 1.6rem;
}
.formulaire {
    background: white;
    padding: 32px;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}
.champ {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
label {
    font-weight: 600;
    color: #444;
    font-size: 0.95rem;
}
input[type="text"], textarea {
    padding: 10px 14px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
    font-family: Arial, sans-serif;
}
input[type="text"]:focus, textarea:focus { border-color: #3355cc; }
.apercu {
    max-width: 100%;
    max-height: 220px;
    border-radius: 8px;
    object-fit: contain;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
button {
    padding: 12px;
    background-color: #3355cc;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
button:hover { background-color: #2244bb; }
.succes {
    text-align: center;
    color: #38a169;
    font-weight: 600;
}
.erreur {
    text-align: center;
    color: #e53e3e;
    font-weight: 600;
}
</style>
