<template>
    <nav>
        <RouterLink to="/">Accueil</RouterLink>
        <RouterLink to="/galerie">Galerie</RouterLink>
        <RouterLink v-if="estAdmin" to="/ajouter">Ajouter</RouterLink>
        <RouterLink to="/compte">Compte</RouterLink>

        <!-- `margin-top: auto` sur le bouton le pousse en bas de la barre,
             quel que soit le nombre de liens au-dessus. -->
        <button type="button" class="deconnexion" @click="seDeconnecter">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Déconnexion
        </button>
    </nav>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { estAdmin, deconnecter } from '../stores/auth.js'

const router = useRouter()

function seDeconnecter() {
    deconnecter()
    router.push('/login')
}
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

.deconnexion {
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 8px;
    color: white;
    font-family: inherit;
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
}
.deconnexion:hover {
    background-color: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.6);
}
.deconnexion svg { width: 17px; height: 17px; flex-shrink: 0; }
</style>
