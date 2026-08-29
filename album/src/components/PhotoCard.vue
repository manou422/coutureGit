<!-- ===================================================================
      PhotoCard.vue — une vignette de la galerie
     ===================================================================

      Ce composant est répété une fois par création par GalerieView. Il
      reçoit la création à afficher dans sa propriété `photo` et va
      chercher lui-même son image : la galerie n'attend donc pas que
      toutes les photos soient arrivées pour se dessiner. -->
<template>
    <!-- Toute la carte est un lien vers le détail de la création. -->
    <RouterLink :to="`/description/${photo.id}`" class="carte">
        <div class="img-wrapper">
            <!-- Tant que l'image n'est pas chargée, on affiche à la place un
                 rectangle gris animé : la grille garde sa forme au lieu de sursauter. -->
            <img v-if="src" :src="src" :alt="photo.titre" />
            <div v-else class="attente" aria-label="Chargement de la photo"></div>
            <!-- Pastille « 3 photos », uniquement quand il y en a plusieurs. -->
            <span v-if="photo.nbPhotos > 1" class="compteur">
                {{ photo.nbPhotos }} photos
            </span>
        </div>
        <div class="description">
            <h3>{{ photo.titre }}</h3>
            <p class="en-savoir-plus">Pour en savoir plus cliquer ici</p>
        </div>
        <!-- Modifier et Supprimer, réservés à l'administratrice.

             `@click.prevent.stop` : `prevent` annule le comportement par défaut
             (suivre le lien de la carte) et `stop` empêche le clic de remonter
             jusqu'à elle. Sans cela, supprimer ouvrirait aussi la création. -->
        <div v-if="estAdmin" class="actions">
            <RouterLink :to="`/modifier/${photo.id}`" class="btn-modifier" title="Modifier" @click.stop>
                ✏️
            </RouterLink>
            <button class="btn-supprimer" @click.prevent.stop="supprimer" title="Supprimer">
                🗑️
            </button>
        </div>
    </RouterLink>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supprimerPhoto } from '../stores/photos.js'
import { estAdmin, urlImage } from '../stores/auth.js'

// `defineProps` déclare ce que le composant reçoit de son parent — ici
// une création : { id, titre, description, categorie, nbPhotos }.
const props = defineProps({ photo: Object })

const src = ref(null)  // adresse locale de l'image, null tant qu'elle charge
// À l'affichage, on demande l'image ; elle arrivera un peu après.
onMounted(async () => { src.value = await urlImage(props.photo.id) })
// En quittant la page, on libère l'adresse locale : sans cela, l'image
// resterait en mémoire pour rien.
onUnmounted(() => { if (src.value) URL.revokeObjectURL(src.value) })


// Demande confirmation, puis supprime. Le store retire la création de
// la liste, ce qui fait disparaître la carte immédiatement.
async function supprimer() {
    if (!confirm(`Supprimer "${props.photo.titre}" ?`)) return
    try {
        await supprimerPhoto(props.photo.id)
    } catch (e) {
        alert(e.message)
    }
}
</script>

<style scoped>
/* La carte : fond blanc, coins arrondis, et une légère ombre qui
   s'accentue au survol pendant que la carte se soulève (`transform`).
   */
.carte {
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
}
.carte:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 10px 24px rgba(0,0,0,0.18);
}
.compteur {
    position: absolute;
    right: 14px;
    bottom: 8px;
    background: rgba(0, 0, 0, 0.62);
    color: white;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 20px;
    letter-spacing: 0.02em;
}
/* Hauteur fixe pour que toutes les cartes soient alignées, quelle que
   soit la forme des photos. `object-fit: contain` montre l'image
   entière, sans la rogner.
   */
.img-wrapper {
    position: relative;
    width: 100%;
    height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 16px 16px 0;
}
.img-wrapper img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.3s ease;
}
/* Réserve la place de l'image pendant son chargement : la grille ne
   sursaute pas quand les photos arrivent une à une. */
.attente {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    background: linear-gradient(100deg, #eee 30%, #f6f6f6 50%, #eee 70%);
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
.carte:hover .img-wrapper img {
    transform: scale(1.04);
}
.description {
    padding: 14px;
    font-size: 0.95rem;
    color: #555;
    text-align: center;
}
.description h3 {
    font-size: 1rem;
    color: #222;
    margin-bottom: 6px;
}
.en-savoir-plus {
    font-size: 0.85rem;
    color: black;
    font-style: italic;
}
.actions {
    display: flex;
    justify-content: center;
    padding: 8px 14px 12px;
    border-top: 1px solid #f0f0f0;
    margin-top: auto;
}
.btn-modifier {
    font-size: 1.3rem;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 6px;
    transition: background 0.2s;
    text-decoration: none;
}
.btn-modifier:hover { background-color: #e8f0ff; }
.btn-supprimer {
    background: none;
    border: none;
    font-size: 1.3rem;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 6px;
    transition: background 0.2s;
}
.btn-supprimer:hover { background-color: #ffe5e5; }
</style>
