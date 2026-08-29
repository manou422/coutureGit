<!-- ===================================================================
      DescriptionView.vue — le détail d'une création
     ===================================================================

      Affiche une création en grand, avec ses vignettes dessous quand elle
      compte plusieurs photos. On y arrive en cliquant une carte de la
      galerie ; l'adresse contient l'identifiant : /description/12. -->
<template>
    <div class="description-page">
        <!-- Un `template` ne produit aucune balise : il sert seulement à
             regrouper plusieurs éléments sous une même condition. Tant que la
             création n'est pas arrivée, on affiche « Chargement... ». -->
        <template v-if="photo">
            <div class="visuel">
                <img v-if="srcActive" :src="srcActive" :alt="photo.titre" />
                <div v-else class="attente"></div>
            </div>

            <!-- Les vignettes n'apparaissent que s'il y a de quoi choisir -->
            <div v-if="photo.images.length > 1" class="vignettes">
                <!-- Cliquer une vignette change simplement le numéro de la photo active ;
                     l'image du haut suit toute seule, puisqu'elle en est déduite. -->
                <button
                    v-for="(img, i) in photo.images"
                    :key="img.id"
                    class="vignette"
                    :class="{ active: i === indexActif }"
                    :aria-label="`Photo ${i + 1} sur ${photo.images.length}`"
                    :aria-current="i === indexActif"
                    @click="indexActif = i"
                >
                    <img v-if="sources[img.id]" :src="sources[img.id]" alt="" />
                    <span v-else class="attente-vignette"></span>
                </button>
            </div>

            <h1>{{ photo.titre }}</h1>
            <p v-if="photo.description">{{ photo.description }}</p>
        </template>
        <p v-else>Chargement...</p>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { api, urlPhoto } from '../stores/auth.js'

const route      = useRoute()
const photo      = ref(null)
// Les images déjà téléchargées, rangées par identifiant de photo.
// Elles arrivent une par une, sans ordre garanti.
const sources    = ref({})   // id de photo -> URL locale
const indexActif = ref(0)

// L'image affichée en grand : celle du rang actif, si elle est arrivée.
const srcActive = computed(() => {
    const img = photo.value?.images?.[indexActif.value]
    return img ? sources.value[img.id] : null
})

// À l'ouverture : on demande la création (titre, description et la
// liste des identifiants de ses photos), puis les images elles-mêmes.
// Range l'adresse locale d'une image sous son identifiant. On remplace
// l'objet entier au lieu d'y ajouter une clé : Vue est ainsi certain de
// voir le changement et de redessiner.
async function rangerImage(image) {
    sources.value = { ...sources.value, [image.id]: await urlPhoto(image.id) }
}


onMounted(async () => {
    const res = await api(`/api/photos/${route.params.id}`)
    if (!res.ok) return
    photo.value = await res.json()

    // Les images sont demandées l'une après l'autre, dans l'ordre : la
    // première arrive donc tout de suite et la page devient lisible,
    // pendant que les suivantes continuent d'arriver.
    for (const image of photo.value.images) {
        await rangerImage(image)
    }
})

// En quittant la page, on libère toutes les adresses locales créées.
onUnmounted(() => {
    for (const url of Object.values(sources.value)) {
        if (url) URL.revokeObjectURL(url)
    }
})
</script>

<style scoped>
.description-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    font-family: Arial, sans-serif;
    background-color: #f4f4f4;
    gap: 16px;
    padding: 70px 20px 40px;
    box-sizing: border-box;
}
.visuel {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
}
/* `max-height: 60vh` empêche une photo verticale d'occuper tout l'écran. */
.visuel img {
    max-width: 420px;
    max-height: 60vh;
    width: auto;
    height: auto;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    object-fit: contain;
}
.attente {
    width: 320px;
    max-width: 100%;
    height: 320px;
    border-radius: 12px;
    background: linear-gradient(100deg, #e8e8e8 30%, #f4f4f4 50%, #e8e8e8 70%);
    background-size: 200% 100%;
    animation: glisse 1.2s ease-in-out infinite;
}
.vignettes {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
    max-width: 100%;
}
.vignette {
    width: 66px;
    height: 66px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    background: #e8e8e8;
    transition: border-color 0.2s, transform 0.2s;
}
.vignette:hover { transform: translateY(-2px); }
/* Un cadre bleu marque la vignette en cours. */
.vignette.active { border-color: #3355cc; }
.vignette img { width: 100%; height: 100%; object-fit: cover; display: block; }
.attente-vignette {
    display: block;
    width: 100%;
    height: 100%;
    background: linear-gradient(100deg, #e8e8e8 30%, #f4f4f4 50%, #e8e8e8 70%);
    background-size: 200% 100%;
    animation: glisse 1.2s ease-in-out infinite;
}
@keyframes glisse {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
}
/* Respecte le réglage système « réduire les animations » : les
   rectangles d'attente cessent alors de clignoter.
   */
@media (prefers-reduced-motion: reduce) {
    .attente, .attente-vignette { animation: none; }
    .vignette:hover { transform: none; }
}
h1 { font-size: 1.8rem; color: #222; text-align: center; }
p {
    font-size: 1rem;
    color: #555;
    max-width: 500px;
    text-align: center;
    line-height: 1.6;
}
</style>
