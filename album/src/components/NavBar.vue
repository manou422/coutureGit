<template>
    <nav>
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

            <div v-if="ouvert" class="sous-menu">
                <RouterLink
                    v-for="c in categories"
                    :key="c.nom"
                    :to="{ path: '/galerie', query: { categorie: c.nom } }"
                    class="categorie"
                    :class="{ actif: categorieActive === c.nom }"
                    :title="c.nom"
                >
                    <span class="nom">{{ c.nom }}</span>
                    <span class="nombre">{{ c.nombre }}</span>
                </RouterLink>

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

        <RouterLink v-if="estAdmin" to="/ajouter">Ajouter</RouterLink>
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

const route  = useRoute()
const router = useRouter()

const categorieActive = computed(() => route.query.categorie || null)
// Déplié d'emblée si on arrive déjà sur une catégorie.
const ouvert = ref(!!route.query.categorie)

onMounted(chargerCategories)

// La liste change quand une création est ajoutée, modifiée ou supprimée.
watch(() => route.fullPath, chargerCategories)

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
    overflow-y: auto;
}
nav > a {
    color: white;
    text-decoration: none;
    font-size: 0.95rem;
    padding: 10px 12px;
    border-radius: 8px;
    transition: background 0.2s;
}
nav > a:hover { background-color: rgba(255,255,255,0.15); }
nav > a.router-link-active { background-color: rgba(255,255,255,0.25); font-weight: 600; }

.groupe-galerie { display: flex; flex-direction: column; gap: 4px; }
.lien-galerie {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    color: white;
    text-decoration: none;
    font-size: 0.95rem;
    padding: 10px 6px 10px 12px;
    border-radius: 8px;
    transition: background 0.2s;
}
.lien-galerie:hover { background-color: rgba(255,255,255,0.15); }
/* `exact-active` seul : sinon le lien resterait surligné sur une catégorie. */
.lien-galerie.router-link-exact-active { background-color: rgba(255,255,255,0.25); font-weight: 600; }

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
.categorie:hover { background-color: rgba(255,255,255,0.15); color: white; }
.categorie.actif { background-color: rgba(255,255,255,0.25); color: white; font-weight: 600; }
.nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
