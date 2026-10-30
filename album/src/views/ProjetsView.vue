<!-- ===================================================================
      ProjetsView.vue — les projets en cours
     ===================================================================

      L'album montre ce qui est fini ; cette page montre ce qui est en
      train de se faire. Ce sont des créations comme les autres, à ceci
      près qu'elles portent le drapeau `enCours` : le serveur les retire
      alors de la galerie et des compteurs de catégories, et ne les
      renvoie qu'ici. Une création passe d'un côté à l'autre par la case
      à cocher des formulaires d'ajout et de modification.

      La grille est celle de la galerie, aux mêmes mesures, et chaque
      vignette reste un PhotoCard : on ouvre, modifie et supprime un
      projet exactement comme une création terminée. -->
<template>
    <div class="projets">
        <h1>Projets en cours</h1>

        <p v-if="photos.length" class="compte">
            {{ photos.length }} projet{{ photos.length > 1 ? 's' : '' }} en cours
        </p>

        <!-- Trois affichages, dans cet ordre : la grille si elle a de quoi se
             remplir, « Chargement… » pendant l'attente, sinon un mot sur ce
             qui rendrait la page moins vide. -->
        <div v-if="photos.length" class="tableau">
            <PhotoCard v-for="photo in photos" :key="photo.id" :photo="photo" />
        </div>
        <p v-else-if="chargement" class="etat">Chargement...</p>
        <template v-else>
            <p class="etat">Aucun projet en cours pour le moment.</p>
            <!-- Elle seule peut y changer quelque chose : autant lui dire où,
                 plutôt que de laisser une page vide sans explication. Les
                 membres, eux, n'ont que faire d'une consigne inapplicable. -->
            <p v-if="estAdmin" class="etat-aide">
                Cochez « Projet en cours » en
                <RouterLink to="/ajouter">ajoutant une création</RouterLink>,
                ou sur une création déjà enregistrée, pour la ranger ici le
                temps de la terminer.
            </p>
        </template>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PhotoCard from '../components/PhotoCard.vue'
import { photos, chargerProjets } from '../stores/photos.js'
import { estAdmin } from '../stores/auth.js'

const chargement = ref(true)  // vrai pendant l'attente de la réponse du serveur

// La page n'a ni filtre ni paramètre d'adresse : un seul chargement, à
// l'affichage, suffit — contrairement à la galerie, qui doit surveiller
// la catégorie demandée.
onMounted(async () => {
    await chargerProjets()
    chargement.value = false
})
</script>

<style scoped>
/* Mêmes mesures que GalerieView : les deux pages se succèdent dans le
   menu, et un écart de padding se verrait au passage de l'une à l'autre. */
.projets {
    padding: 70px 20px 40px;
    min-height: 100vh;
}
h1 {
    text-align: center;
    margin-bottom: 8px;
    color: #333;
}
.compte {
    text-align: center;
    color: #777;
    font-size: 0.9rem;
    margin-bottom: 24px;
}
.etat {
    text-align: center;
    color: #888;
    margin-top: 40px;
}
.etat-aide {
    text-align: center;
    color: #888;
    font-size: 0.88rem;
    line-height: 1.5;
    max-width: 420px;
    margin: 10px auto 0;
}
.etat-aide a { color: #8e5c56; font-weight: 600; }
/* `auto-fill` avec `minmax(250px, 1fr)` place autant de colonnes de
   250 px minimum que la largeur le permet : le nombre de colonnes
   s'adapte seul, du téléphone au grand écran. */
.tableau {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 24px;
    max-width: 1000px;
    margin: 32px auto 0;
}
</style>
