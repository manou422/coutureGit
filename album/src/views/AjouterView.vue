<template>
    <div class="ajouter">
        <h1>Ajouter une création</h1>

        <form @submit.prevent="soumettre" class="formulaire">
            <div class="champ">
                <label>Titre</label>
                <input v-model="titre" type="text" placeholder="Nom de la création" required />
            </div>

            <div class="champ">
                <label>Description</label>
                <textarea v-model="description" placeholder="Décrivez votre création..." rows="4"></textarea>
            </div>

            <div class="champ">
                <label>Photo</label>
                <input type="file" accept="image/*" @change="chargerFichier" required />
                <img v-if="apercu" :src="apercu" class="apercu" alt="aperçu" />
            </div>

            <button type="submit" :disabled="!apercu">Ajouter</button>
            <p v-if="succes" class="succes">Création ajoutée avec succès !</p>
        </form>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ajouterPhoto } from '../stores/photos.js'

const router      = useRouter()
const titre       = ref('')
const description = ref('')
const apercu      = ref(null)
const succes      = ref(false)
let   fichierBase64 = null

function chargerFichier(e) {
    const fichier = e.target.files[0]
    if (!fichier) return
    const reader = new FileReader()
    reader.onload = () => {
        apercu.value  = reader.result
        fichierBase64 = reader.result
    }
    reader.readAsDataURL(fichier)
}

async function soumettre() {
    await ajouterPhoto({
        photo:       fichierBase64,
        titre:       titre.value,
        description: description.value
    })
    succes.value = true
    setTimeout(() => router.push('/galerie'), 1200)
}
</script>

<style scoped>
.ajouter {
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
    margin-top: 10px;
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
button:hover:not(:disabled) { background-color: #2244bb; }
button:disabled { background-color: #aaa; cursor: default; }
.succes {
    text-align: center;
    color: #38a169;
    font-weight: 600;
}
</style>
