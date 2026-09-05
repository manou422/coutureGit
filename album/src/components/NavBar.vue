<!-- ===================================================================
      NavBar.vue — le menu, à gauche de toutes les pages
     ===================================================================

      Il contient le logo, les liens principaux, la liste dépliable des
      catégories, et le bouton de déconnexion. Trois liens ne sont montrés
      que si la personne connectée est l'administratrice. -->
<template>
    <nav>
        <!-- Le logo ouvre le menu. Il n'est volontairement pas cliquable :
             le lien « Accueil » juste en dessous fait déjà ce travail, et
             deux chemins vers la même page se marchent dessus. -->
        <img class="logo" src="/photos/logo-manucrea.png"
             alt="ManuCrea Couture — fait main avec passion" />
        <div class="filet" aria-hidden="true"></div>

        <!-- `RouterLink` remplace `<a href>` : il change la page sans la
             recharger, et se marque tout seul comme actif quand on s'y trouve
             (classe router-link-active, stylée plus bas). -->
        <RouterLink to="/">Accueil</RouterLink>

        <div class="groupe-galerie">
            <!-- Un clic navigue vers la galerie complète ET déplie la liste :
                 le lien reste utilisable tel quel, les catégories s'ajoutent. -->
            <RouterLink
                to="/galerie"
                class="lien-galerie"
                :class="{ 'sous-menu-ouvert': ouvert }"
                :aria-expanded="ouvert"
                @click="ouvert = true"
            >
                <span>Galerie</span>
                <button
                    type="button"
                    class="chevron"
                    :aria-label="ouvert ? 'Replier les catégories' : 'Déplier les catégories'"
                    @click.prevent.stop="ouvert = !ouvert"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                         stroke-linecap="round" stroke-linejoin="round" :class="{ pivote: ouvert }">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            </RouterLink>

            <!-- La liste des catégories, affichée seulement quand le menu est déplié. -->
            <div v-if="ouvert" class="sous-menu">
                <RouterLink to="/categories" class="categorie categorie-toutes">
                    <span class="nom">Toutes les catégories</span>
                </RouterLink>

                <!-- `v-for` répète cet élément pour chaque catégorie. `:key` donne à Vue
                     un repère stable pour suivre chaque ligne quand la liste change.
                     Le `:to` construit le lien /galerie?categorie=... , qui est lu par
                     GalerieView pour filtrer les créations affichées. -->
                <RouterLink
                    v-for="c in categories"
                    :key="c.nom"
                    :to="{ path: '/galerie', query: { categorie: c.nom } }"
                    class="categorie"
                    :class="{ actif: categorieActive === c.nom, masquee: !c.visible }"
                    :title="c.visible ? c.nom : `${c.nom} — masquée aux autres membres`"
                >
                    <span class="nom">
                        <!-- Œil barré : seule l'administratrice reçoit les
                             catégories masquées, l'icône lui rappelle
                             lesquelles ne sont pas publiques. -->
                        <svg v-if="!c.visible" class="oeil" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round" aria-hidden="true">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                        {{ c.nom }}
                    </span>
                    <span class="nombre">{{ c.nombre }}</span>
                </RouterLink>

                <!-- Entrée « Non classées », affichée seulement s'il en existe. -->
                <RouterLink
                    v-if="sansCategorie > 0"
                    :to="{ path: '/galerie', query: { categorie: 'sans' } }"
                    class="categorie"
                    :class="{ actif: categorieActive === 'sans' }"
                >
                    <span class="nom nom-sans">Non classées</span>
                    <span class="nombre">{{ sansCategorie }}</span>
                </RouterLink>

                <p v-if="!categories.length && !sansCategorie" class="vide">
                    Aucune catégorie
                </p>
            </div>
        </div>

        <!-- Réservé à l'administratrice. Cacher un lien n'est qu'un confort :
             c'est le serveur qui refuse pour de bon (voir adminSeulement). -->
        <RouterLink v-if="estAdmin" to="/ajouter">Ajouter</RouterLink>
        <RouterLink v-if="estAdmin" to="/statistiques">Fréquentation</RouterLink>
        <RouterLink to="/compte">Compte</RouterLink>

        <!-- `margin-top: auto` pousse le bouton en bas, quel que soit le
             nombre de liens au-dessus. -->
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
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { estAdmin, deconnecter, categories, sansCategorie, chargerCategories } from '../stores/auth.js'

// `useRoute` donne la page courante (son chemin, ses paramètres) ;
// `useRouter` sert à en changer par le code.
const route  = useRoute()
const router = useRouter()

// La catégorie lue dans l'adresse, pour surligner la bonne ligne.
const categorieActive = computed(() => route.query.categorie || null)
// Déplié d'emblée si on arrive déjà sur une catégorie.
const ouvert = ref(!!route.query.categorie)

// `onMounted` : à exécuter une fois que le composant est affiché.
// C'est le moment habituel pour aller chercher des données.
onMounted(chargerCategories)

// La liste change quand une création est ajoutée, modifiée ou supprimée.
watch(() => route.fullPath, chargerCategories)

function seDeconnecter() {
    deconnecter()
    router.push('/login')
}
</script>

<style scoped>
/* Le menu est une colonne fixée à gauche, sur toute la hauteur
   (100vh = 100 % de la hauteur de la fenêtre). `overflow-y: auto` lui
   permet de défiler seul quand les catégories sont nombreuses.

   Le dégradé, à peine perceptible, évite l'aplat un peu dur d'une
   couleur unie sur une bande aussi haute. Les deux tons sont ceux du
   logo, assombris pour que le texte blanc reste lisible par-dessus.
   */
nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 190px;
    height: 100vh;
    background: linear-gradient(180deg, #7c5450 0%, #5e403d 100%);
    padding: 22px 14px 28px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
    /* Barre de défilement discrète : la barre système, claire et large,
       trancherait sur le fond sombre. */
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.3) transparent;
}
nav::-webkit-scrollbar { width: 6px; }
nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.28); border-radius: 3px; }

/* Le logo est carré, sur fond crème : le `border-radius` le ramène au
   rond de son propre dessin, et ne rogne que les coins, restés vides.
   `flex-shrink: 0` l'empêche d'être écrasé quand les catégories sont
   assez nombreuses pour remplir la colonne. */
.logo {
    display: block;
    width: 128px;
    height: 128px;
    margin: 0 auto;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.5);
    box-shadow: 0 6px 18px rgba(0,0,0,0.3);
    flex-shrink: 0;
}
/* Filet dégradé : il sépare le logo des liens sans poser un trait net
   d'un bord à l'autre, qui ferait lourd. */
.filet {
    height: 1px;
    margin: 2px 2px 4px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    flex-shrink: 0;
}

/* Le `>` ne vise que les liens directs du menu, pas ceux du sous-menu. */
nav > a {
    color: #f8efec;
    text-decoration: none;
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    padding: 10px 12px;
    border-radius: 8px;
    transition: background 0.2s, box-shadow 0.2s;
}
nav > a:hover { background-color: rgba(255,255,255,0.14); }
/* Le liseré clair à gauche marque la page courante plus franchement que
   le seul fond, qui reste discret sur ce dégradé. */
nav > a.router-link-active {
    background-color: rgba(255,255,255,0.22);
    font-weight: 600;
    color: #fff;
    box-shadow: inset 3px 0 0 #e8c3bc;
}

.groupe-galerie { display: flex; flex-direction: column; gap: 4px; }
.lien-galerie {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    color: #f8efec;
    text-decoration: none;
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    padding: 10px 6px 10px 12px;
    border-radius: 8px;
    transition: background 0.2s, box-shadow 0.2s;
}
.lien-galerie:hover { background-color: rgba(255,255,255,0.14); }
/* `exact-active` seul : sinon le lien resterait surligné sur une catégorie. */
.lien-galerie.router-link-exact-active {
    background-color: rgba(255,255,255,0.22);
    font-weight: 600;
    color: #fff;
    box-shadow: inset 3px 0 0 #e8c3bc;
}

.chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 4px;
    flex-shrink: 0;
}
.chevron:hover { background-color: rgba(255,255,255,0.2); }
.chevron svg { width: 14px; height: 14px; transition: transform 0.2s; }
.chevron svg.pivote { transform: rotate(180deg); }

/* Le trait vertical clair à gauche rattache visuellement les catégories au lien Galerie. */
.sous-menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 10px;
    border-left: 2px solid rgba(255,255,255,0.25);
    margin-left: 6px;
}
.categorie {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    color: rgba(255,255,255,0.88);
    text-decoration: none;
    font-size: 0.83rem;
    padding: 7px 8px;
    border-radius: 6px;
    transition: background 0.2s, color 0.2s;
}
.categorie:hover { background-color: rgba(255,255,255,0.14); color: white; }
.categorie.actif {
    background-color: rgba(255,255,255,0.22);
    color: white;
    font-weight: 600;
    box-shadow: inset 3px 0 0 #e8c3bc;
}
.nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.categorie.masquee .nom { opacity: 0.75; }
.oeil {
    width: 12px;
    height: 12px;
    vertical-align: -1px;
    margin-right: 3px;
    flex-shrink: 0;
}
/* Entrée d'en-tête : séparée des catégories elles-mêmes. */
.categorie-toutes {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid rgba(255,255,255,0.22);
    border-radius: 6px 6px 0 0;
}
.categorie-toutes .nom { white-space: normal; line-height: 1.3; }
.nom-sans { font-style: italic; opacity: 0.85; }
.nombre {
    font-size: 0.72rem;
    background: rgba(0,0,0,0.22);
    padding: 1px 6px;
    border-radius: 10px;
    flex-shrink: 0;
}
.vide {
    font-size: 0.78rem;
    color: rgba(255,255,255,0.65);
    font-style: italic;
    padding: 6px 8px;
}

/* `margin-top: auto` pousse ce bouton tout en bas de la colonne. */
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
