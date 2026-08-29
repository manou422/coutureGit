<!-- ===================================================================
      IconeOeil.vue — l'œil des champs « mot de passe »
     ===================================================================

      Le même dessin était écrit à la main dans les trois formulaires qui
      demandent un mot de passe : connexion, inscription et « Mon compte ».
      Deux lignes de plus de 300 caractères chacune, recopiées trois fois.

      Il est désormais ici, une fois pour toutes. `barre` choisit lequel
      des deux dessins afficher :

        false → l'œil ouvert : le mot de passe est caché, cliquer le montre
        true  → l'œil barré  : le mot de passe est visible
     -->
<template>
    <svg v-if="!barre"
         xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>

    <svg v-else
         xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
</template>

<script setup>
// `defineProps` déclare ce que le composant reçoit de son parent.
defineProps({ barre: Boolean })
</script>

<style scoped>
/* La taille est posée ici pour que le composant se suffise à lui-même ;
   les formulaires qui l'emploient la répètent de leur côté, ce qui reste
   sans effet mais ne fait pas de mal. */
svg { width: 20px; height: 20px; }
</style>
