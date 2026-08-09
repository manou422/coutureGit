<template>
    <div class="description-page">
        <template v-if="photo">
            <img v-if="src" :src="src" :alt="photo.titre" />
            <div v-else class="attente"></div>
            <h1>{{ photo.titre }}</h1>
            <p>{{ photo.description }}</p>
        </template>
        <p v-else>Chargement...</p>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { api, urlImage } from '../stores/auth.js'

const route = useRoute()
const photo = ref(null)
const src   = ref(null)

onMounted(async () => {
    // Le titre et la description arrivent aussitôt ; l'image suit.
    const res = await api(`/api/photos/${route.params.id}`)
    if (!res.ok) return
    photo.value = await res.json()
    src.value   = await urlImage(route.params.id)
})
onUnmounted(() => { if (src.value) URL.revokeObjectURL(src.value) })
</script>

<style scoped>
.description-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    overflow: hidden;
    font-family: Arial, sans-serif;
    background-color: #f4f4f4;
    gap: 16px;
    padding-top: 50px;
    box-sizing: border-box;
}
img {
    max-width: 420px;
    max-height: calc(100vh - 200px);
    width: auto;
    height: auto;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
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
@keyframes glisse {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
    .attente { animation: none; }
}
h1 { font-size: 1.8rem; color: #222; }
p {
    font-size: 1rem;
    color: #555;
    max-width: 500px;
    text-align: center;
    line-height: 1.6;
}
</style>
