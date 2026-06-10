<template>
    <div class="description-page">
        <template v-if="photo">
            <img :src="photo.photo" :alt="photo.titre" />
            <h1>{{ photo.titre }}</h1>
            <p>{{ photo.description }}</p>
        </template>
        <p v-else>Chargement...</p>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const photo = ref(null)

onMounted(async () => {
    const res  = await fetch(`/api/photos/${route.params.id}`)
    photo.value = await res.json()
})
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
h1 { font-size: 1.8rem; color: #222; }
p {
    font-size: 1rem;
    color: #555;
    max-width: 500px;
    text-align: center;
    line-height: 1.6;
}
</style>
