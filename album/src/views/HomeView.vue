<template>
    <div class="home">
        <h1>Bienvenue dans mon album</h1>
        <RouterLink to="/galerie">
            <img src="/photos/couture.webp" alt="Couture" />
        </RouterLink>
    </div>
</template>

<style scoped>
.home {
    padding-top: 20px;
    text-align: center;
}
h1 {
    margin: 0 0 16px 0;
    color: #333;
}
img {
    max-width: 100%;
    height: auto;
    cursor: pointer;
}
</style>
