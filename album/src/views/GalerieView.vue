<!-- ===================================================================
      GalerieView.vue — la grille des créations
     ===================================================================

      Affiche toutes les créations, ou seulement celles d'une catégorie
      quand l'adresse porte ?categorie=... (les liens du menu). Chaque
      vignette est un PhotoCard, qui charge son image de son côté. -->
<template>
    <div class="galerie">
        <h1>
            {{ titre }}
            <!-- Rappel visible d'elle seule : cette catégorie est cachée aux membres. -->
            <span v-if="masquee" class="badge-masquee">Masquée</span>
        </h1>

        <p v-if="masquee" class="note-masquee">
            Vous seule voyez cette catégorie. Rendez-la visible depuis
            <RouterLink to="/categories">Toutes les catégories</RouterLink>.
        </p>

        <p v-if="categorieActive" class="filtre">
            {{ photos.length }} création{{ photos.length > 1 ? 's' : '' }}
            <RouterLink to="/galerie" class="tout-voir">— voir toutes les créations</RouterLink>
        </p>

        <!-- Trois affichages possibles, dans cet ordre : la grille si on a des
             créations, « Chargement… » pendant l'attente, sinon un message
             expliquant qu'il n'y a rien à montrer. -->
        <div v-if="photos.length" class="tableau">
            <!-- Une carte par création. `:photo="photo"` transmet la création au
                 composant enfant (voir `defineProps` dans PhotoCard.vue). -->
            <PhotoCard v-for="photo in photos" :key="photo.id" :photo="photo" />
        </div>
        <p v-else-if="chargement" class="etat">Chargement...</p>
        <p v-else class="etat">
            {{ categorieActive ? 'Aucune création dans cette catégorie.' : 'Aucune création pour le moment.' }}
        </p>
    </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import PhotoCard from '../components/PhotoCard.vue'
import { photos, chargerPhotos } from '../stores/photos.js'
import { categories, chargerCategories } from '../stores/auth.js'

const route      = useRoute()
const chargement = ref(true)  // vrai pendant l'attente de la réponse du serveur

const categorieActive = computed(() => route.query.categorie || null)

// Le serveur ne renvoie les catégories masquées qu'à l'administratrice :
// personne d'autre ne peut voir ce bandeau, ni la galerie qu'il coiffe.
const masquee = computed(() =>
    categories.value.some(c => c.nom === categorieActive.value && !c.visible))

const titre = computed(() => {
    if (!categorieActive.value) return 'Mes créations'
    return categorieActive.value === 'sans' ? 'Créations non classées' : categorieActive.value
})

onMounted(chargerCategories)

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
.badge-masquee {
    display: inline-block;
    vertical-align: middle;
    margin-left: 8px;
    padding: 3px 10px;
    border-radius: 12px;
    background: #f0e6fb;
    color: #6b3fa0;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
}
.note-masquee {
    text-align: center;
    color: #6b3fa0;
    font-size: 0.87rem;
    margin-top: 8px;
}
.note-masquee a { color: #6b3fa0; font-weight: 600; }
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
/* La grille : `auto-fill` avec `minmax(250px, 1fr)` place autant de
   colonnes de 250 px minimum que la largeur le permet. Le nombre de
   colonnes s'adapte donc seul, du téléphone au grand écran, sans qu'on
   ait à l'écrire.
   */
.tableau {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 24px;
    max-width: 1000px;
    margin: 32px auto 0;
}
</style>
