<!-- ===================================================================
      HomeView.vue — la page d'accueil
     ===================================================================

      Le plus simple des écrans : un titre et une photo cliquable qui mène
      à la galerie. Pas de script : rien n'y est calculé. -->
<template>
    <div class="home">
        <h1>Bienvenue dans mon album</h1>
        <RouterLink to="/galerie">
            <!-- Cette image vient du dossier album/public/ : elle est livrée avec le
                 site, contrairement aux créations, qui viennent de la base de données. -->
            <img src="/photos/couture.webp" alt="Couture" />
        </RouterLink>
    </div>
</template>

<style scoped>
/* « scoped » : ces règles ne valent que pour ce fichier. Vue ajoute
   discrètement un marqueur à chaque balise du composant et le reprend
   dans chaque sélecteur, ce qui évite qu'un `.page` défini ici déteigne
   sur une autre vue portant la même classe.
   */
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
