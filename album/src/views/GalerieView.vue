<template>
    <div class="galerie">
        <h1>Mes créations</h1>
        <div class="tableau">
            <PhotoCard v-for="photo in photos" :key="photo.id" :photo="photo" />
        </div>
    </div>
</template>

<script setup>
import { onMounted } from 'vue'
import PhotoCard from '../components/PhotoCard.vue'
import { photos, chargerPhotos } from '../stores/photos.js'

onMounted(() => chargerPhotos())
</script>

<style scoped>
.galerie {
    padding: 70px 20px 40px;
    min-height: 100vh;
}
h1 {
    text-align: center;
    margin-bottom: 32px;
    color: #333;
}
.tableau {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 24px;
    max-width: 1000px;
    margin: 0 auto;
}
</style>
