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
                <label>Photos <span class="optionnel">(plusieurs possibles, 12 au maximum)</span></label>
                <input type="file" accept="image/*" multiple @change="chargerFichiers" />

                <p v-if="chargementPhotos" class="poids">Optimisation en cours...</p>

                <div v-if="photos.length" class="apercus">
                    <div v-for="(p, i) in photos" :key="i" class="apercu-item">
                        <img :src="p" alt="" />
                        <span v-if="i === 0" class="badge-couverture">Couverture</span>
                        <button type="button" class="retirer" :aria-label="`Retirer la photo ${i + 1}`"
                                @click="retirer(i)">×</button>
                    </div>
                </div>
                <p v-if="photos.length" class="poids">
                    {{ photos.length }} photo{{ photos.length > 1 ? 's' : '' }} — {{ poidsTotal }}.
                    La première sert de couverture en galerie.
                </p>
            </div>

            <button type="submit" :disabled="!photos.length || chargementPhotos">Ajouter</button>
            <p v-if="erreur" class="erreur">{{ erreur }}</p>
            <p v-if="succes" class="succes">Création ajoutée avec succès !</p>
        </form>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ajouterPhoto } from '../stores/photos.js'
import { redimensionner, poidsLisible } from '../utils/image.js'

const LIMITE = 12

const router      = useRouter()
const titre       = ref('')
const description = ref('')
const photos      = ref([])
const succes      = ref(false)
const erreur      = ref('')
const chargementPhotos = ref(false)

const poidsTotal = computed(() => poidsLisible(photos.value.join('')))

async function chargerFichiers(e) {
    const fichiers = Array.from(e.target.files || [])
    if (!fichiers.length) return
    erreur.value = ''
    chargementPhotos.value = true
    try {
        for (const fichier of fichiers) {
            if (photos.value.length >= LIMITE) {
                erreur.value = `${LIMITE} photos au maximum par création`
                break
            }
            photos.value.push(await redimensionner(fichier))
        }
    } catch (err) {
        erreur.value = err.message
    } finally {
        chargementPhotos.value = false
        e.target.value = ''   // permet de resélectionner le même fichier
    }
}

function retirer(i) {
    photos.value.splice(i, 1)
}

async function soumettre() {
    erreur.value = ''
    try {
        await ajouterPhoto({
            photos:      photos.value,
            titre:       titre.value,
            description: description.value
        })
    } catch (e) {
        erreur.value = e.message
        return
    }
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
.erreur {
    text-align: center;
    color: #e53e3e;
    font-weight: 600;
}
.poids {
    font-size: 0.82rem;
    color: #777;
    margin-top: 6px;
    line-height: 1.4;
}
.optionnel {
    font-weight: 400;
    color: #999;
    font-size: 0.8rem;
}
.apercus {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 10px;
    margin-top: 12px;
}
.apercu-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #f0f0f0;
}
.apercu-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.badge-couverture {
    position: absolute;
    left: 0;
    bottom: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.62);
    color: white;
    font-size: 0.66rem;
    font-weight: 600;
    text-align: center;
    padding: 2px 0;
}
.retirer {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.62);
    color: white;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
}
.retirer:hover { background: #e53e3e; }
</style>
