<template>
    <div :class="afficherNav ? 'avec-nav' : ''">
        <NavBar v-if="afficherNav" />
        <BoutonRetour v-if="afficherRetour" />
        <RouterView />
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import BoutonRetour from './components/BoutonRetour.vue'

const route = useRoute()
const pagesAuth = ['/login', '/inscription', '/mot-de-passe-oublie']
const estPageAuth = (chemin) =>
    pagesAuth.includes(chemin) || chemin.startsWith('/reinitialiser/')

const afficherNav     = computed(() => !estPageAuth(route.path))
const afficherRetour  = computed(() =>
    !estPageAuth(route.path) &&
    route.path !== '/' &&
    route.path !== '/ajouter' &&
    route.path !== '/galerie'
)
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
.avec-nav { padding-left: 160px; }
</style>
