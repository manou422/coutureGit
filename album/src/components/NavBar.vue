<template>
    <nav>
        <RouterLink to="/">Accueil</RouterLink>
        <RouterLink to="/galerie">Galerie</RouterLink>
        <RouterLink v-if="estAdmin" to="/ajouter">Ajouter</RouterLink>
        <RouterLink to="/compte">Compte</RouterLink>
    </nav>
</template>

<script setup>
import { estAdmin } from '../stores/auth.js'
</script>

<style scoped>
nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 160px;
    height: 100vh;
    background-color: #3355cc;
    padding: 40px 16px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
nav a {
    color: white;
    text-decoration: none;
    font-size: 0.95rem;
    padding: 10px 12px;
    border-radius: 8px;
    transition: background 0.2s;
}
nav a:hover { background-color: rgba(255,255,255,0.15); }
nav a.router-link-active { background-color: rgba(255,255,255,0.25); font-weight: 600; }
</style>
