<!-- ===================================================================
      BoutonRetour.vue — la flèche en haut à gauche
     ===================================================================

      Le plus petit composant du projet : pas de script du tout, juste un
      bouton et son style. Il est placé par App.vue sur les écrans où l'on
      arrive forcément depuis un autre. -->
<template>
    <!-- `@click` = « au clic, exécute ceci ». `$router.back()` revient à la
         page précédente, exactement comme la flèche du navigateur. -->
    <button class="btn-retour" @click="$router.back()">
        <!-- La flèche est dessinée en SVG plutôt qu'importée comme image : elle
             reste nette à toute taille et ne coûte aucun téléchargement. -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
        </svg>
    </button>
</template>

<style scoped>
/* `position: fixed` : le bouton reste à sa place quand la page défile.
   Le `left` le pose juste à droite du menu, large de 190 px (voir
   NavBar.vue), et `z-index: 999` le maintient au-dessus du contenu.
   */
.btn-retour {
    position: fixed;
    top: 16px;
    left: 206px;
    background: #8e5c56;
    border: none;
    color: white;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    font-size: 1.6rem;
    padding: 10px;
    cursor: pointer;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}
.btn-retour:hover { background: #74463f; }

/* Sur téléphone, le menu ne tient plus la gauche de l'écran : le bouton
   vient se ranger à côté de celui qui l'ouvre — 48 px de large, posé à
   12 px du bord — et s'aligne sur lui. */
@media (max-width: 620px) {
    .btn-retour {
        top: 10px;
        left: 72px;
    }
}
</style>
