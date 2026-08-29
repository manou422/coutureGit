<!-- ===================================================================
      App.vue — le cadre commun à tous les écrans
     ===================================================================

      Un fichier .vue tient en trois blocs, et c'est vrai de tous les
      fichiers du dossier :

        template   ce qui s'affiche (du HTML enrichi de directives Vue) ;
        script     le code qui le pilote ;
        style      les styles, « scoped » = valables pour ce fichier seul.

      App.vue est le premier composant affiché. Il ne montre rien de
      lui-même : il place le menu, le bouton retour, et laisse la place à
      l'écran correspondant à l'adresse courante. -->
<template>
    <!-- Les deux-points devant `class` signifient « ce n'est pas du texte,
         c'est une expression JavaScript ». Ici : la classe avec-nav n'est
         posée que si le menu est affiché — elle décale la page vers la droite
         pour lui laisser la place. -->
    <div :class="afficherNav ? 'avec-nav' : ''">
        <!-- `v-if` : l'élément n'est créé que si la condition est vraie. -->
        <NavBar v-if="afficherNav" />
        <BoutonRetour v-if="afficherRetour" />
        <!-- L'emplacement où le routeur insère l'écran de l'adresse courante
             (GalerieView, CompteView…). Tout le reste de la page ne bouge pas. -->
        <RouterView />
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import BoutonRetour from './components/BoutonRetour.vue'

const route = useRoute()
// Les pages accessibles sans compte. Elles se suffisent à elles-mêmes :
// ni menu, ni bouton retour.
const pagesAuth = ['/login', '/inscription', '/mot-de-passe-oublie']
// La page de réinitialisation porte un jeton dans son adresse, d'où le `startsWith`.
const estPageAuth = (chemin) =>
    pagesAuth.includes(chemin) || chemin.startsWith('/reinitialiser/')

// Deux valeurs calculées, recalculées seules à chaque changement
// d'adresse. Le bouton retour est inutile sur les écrans où l'on
// n'arrive pas depuis un autre : accueil, galerie, ajout.
// Écrans où l'on n'arrive pas depuis un autre : un bouton retour n'y
// aurait aucun sens.
const pagesSansRetour = ['/', '/galerie', '/ajouter']

const afficherNav = computed(() => !estPageAuth(route.path))

const afficherRetour = computed(() =>
    !estPageAuth(route.path) && !pagesSansRetour.includes(route.path))
</script>

<style>
/* Ce bloc <style> est le seul du projet à ne pas être « scoped » : ses
   règles s'appliquent donc à toute l'application.

   La première ligne est une remise à zéro classique : marges et
   espacements internes supprimés partout, et `border-box` pour que la
   largeur annoncée inclue bordure et remplissage.
   */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
/* Décalage égal à la largeur du menu fixe, pour ne rien cacher. */
.avec-nav { padding-left: 160px; }
</style>
