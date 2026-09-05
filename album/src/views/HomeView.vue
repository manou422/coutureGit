<!-- ===================================================================
      HomeView.vue — la page d'accueil
     ===================================================================

      Le plus simple des écrans : un titre et une image de garde. Elle n'est
      pas cliquable — on passe à la galerie par le menu de gauche. Pas de
      script : rien n'y est calculé. -->
<template>
    <div class="home">
        <h1>Bienvenue dans mon album</h1>
        <!-- Cette image vient du dossier album/public/ : elle est livrée avec le
             site, contrairement aux créations, qui viennent de la base de données.
             C'est un dessin qui reprend trois créations de l'album — le pochon, la
             pochette et le chouchou — et non une photo : d'où le format SVG, net à
             toutes les tailles pour 70 ko. -->
        <img src="/photos/accueil-creations.svg"
             alt="Trois créations cousues main : un pochon bleu à léopards, une pochette zippée au tissu mosaïque et un chouchou blanc à cœurs rouges" />
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
/* `min` : l'image occupe la largeur disponible, mais ne s'étire jamais
   au-delà de 760 px — passé cette taille elle écraserait le titre. */
img {
    max-width: min(100%, 760px);
    height: auto;
}
</style>
