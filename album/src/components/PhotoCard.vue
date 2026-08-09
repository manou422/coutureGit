<template>
    <RouterLink :to="`/description/${photo.id}`" class="carte">
        <div class="img-wrapper">
            <img v-if="src" :src="src" :alt="photo.titre" />
            <div v-else class="attente" aria-label="Chargement de la photo"></div>
            <span v-if="photo.nbPhotos > 1" class="compteur">
                {{ photo.nbPhotos }} photos
            </span>
        </div>
        <div class="description">
            <h3>{{ photo.titre }}</h3>
            <p class="en-savoir-plus">Pour en savoir plus cliquer ici</p>
        </div>
        <div v-if="estAdmin" class="actions">
            <RouterLink :to="`/modifier/${photo.id}`" class="btn-modifier" title="Modifier" @click.stop>
                ✏️
            </RouterLink>
            <button class="btn-supprimer" @click.prevent.stop="supprimer" title="Supprimer">
                🗑️
            </button>
        </div>
    </RouterLink>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supprimerPhoto } from '../stores/photos.js'
import { estAdmin, urlImage } from '../stores/auth.js'

const props = defineProps({ photo: Object })

const src = ref(null)
onMounted(async () => { src.value = await urlImage(props.photo.id) })
onUnmounted(() => { if (src.value) URL.revokeObjectURL(src.value) })

async function supprimer() {
    if (!confirm(`Supprimer "${props.photo.titre}" ?`)) return
    try {
        await supprimerPhoto(props.photo.id)
    } catch (e) {
        alert(e.message)
    }
}
</script>

<style scoped>
.carte {
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
}
.carte:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 10px 24px rgba(0,0,0,0.18);
}
.compteur {
    position: absolute;
    right: 14px;
    bottom: 8px;
    background: rgba(0, 0, 0, 0.62);
    color: white;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 20px;
    letter-spacing: 0.02em;
}
.img-wrapper {
    position: relative;
    width: 100%;
    height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 16px 16px 0;
}
.img-wrapper img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.3s ease;
}
/* Réserve la place de l'image pendant son chargement : la grille ne
   sursaute pas quand les photos arrivent une à une. */
.attente {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    background: linear-gradient(100deg, #eee 30%, #f6f6f6 50%, #eee 70%);
    background-size: 200% 100%;
    animation: glisse 1.2s ease-in-out infinite;
}
@keyframes glisse {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
    .attente { animation: none; }
}
.carte:hover .img-wrapper img {
    transform: scale(1.04);
}
.description {
    padding: 14px;
    font-size: 0.95rem;
    color: #555;
    text-align: center;
}
.description h3 {
    font-size: 1rem;
    color: #222;
    margin-bottom: 6px;
}
.en-savoir-plus {
    font-size: 0.85rem;
    color: black;
    font-style: italic;
}
.actions {
    display: flex;
    justify-content: center;
    padding: 8px 14px 12px;
    border-top: 1px solid #f0f0f0;
    margin-top: auto;
}
.btn-modifier {
    font-size: 1.3rem;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 6px;
    transition: background 0.2s;
    text-decoration: none;
}
.btn-modifier:hover { background-color: #e8f0ff; }
.btn-supprimer {
    background: none;
    border: none;
    font-size: 1.3rem;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 6px;
    transition: background 0.2s;
}
.btn-supprimer:hover { background-color: #ffe5e5; }
</style>
