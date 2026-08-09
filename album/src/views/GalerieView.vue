<template>
    <div class="galerie">
        <h1>{{ titre }}</h1>

        <p v-if="categorieActive" class="filtre">
            {{ photos.length }} création{{ photos.length > 1 ? 's' : '' }}
            <RouterLink to="/galerie" class="tout-voir">— voir toutes les créations</RouterLink>
        </p>

        <div v-if="photos.length" class="tableau">
            <PhotoCard v-for="photo in photos" :key="photo.id" :photo="photo" />
        </div>
        <p v-else-if="chargement" class="etat">Chargement...</p>
        <p v-else class="etat">
            {{ categorieActive ? 'Aucune création dans cette catégorie.' : 'Aucune création pour le moment.' }}
        </p>
    </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PhotoCard from '../components/PhotoCard.vue'
import { photos, chargerPhotos } from '../stores/photos.js'

const route      = useRoute()
const chargement = ref(true)

const categorieActive = computed(() => route.query.categorie || null)

const titre = computed(() => {
    if (!categorieActive.value) return 'Mes créations'
    return categorieActive.value === 'sans' ? 'Créations non classées' : categorieActive.value
})

// `immediate` couvre le premier affichage ; le watch gère ensuite les
// passages d'une catégorie à l'autre, qui ne remontent pas le composant.
watch(categorieActive, async (valeur) => {
    chargement.value = true
    await chargerPhotos(valeur)
    chargement.value = false
}, { immediate: true })
</script>

<style scoped>
.galerie {
    padding: 70px 20px 40px;
    min-height: 100vh;
}
h1 {
    text-align: center;
    margin-bottom: 8px;
    color: #333;
}
.filtre {
    text-align: center;
    color: #777;
    font-size: 0.9rem;
    margin-bottom: 24px;
}
.tout-voir {
    color: #3355cc;
    text-decoration: none;
    font-weight: 600;
}
.tout-voir:hover { text-decoration: underline; }
.etat {
    text-align: center;
    color: #888;
    margin-top: 40px;
}
.tableau {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 24px;
    max-width: 1000px;
    margin: 32px auto 0;
}
</style>
