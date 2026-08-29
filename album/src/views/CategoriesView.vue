<!-- ===================================================================
      CategoriesView.vue — « Toutes les catégories »
     ===================================================================

      Les membres y voient la liste et le nombre de créations de chacune.
      L'administratrice peut en plus en créer, les renommer, les masquer
      ou les supprimer.

      Masquer et supprimer sont deux gestes bien différents, et les
      messages de confirmation prennent soin de le dire : masquer cache la
      catégorie aux autres membres sans rien effacer ; supprimer efface la
      catégorie, mais ses créations deviennent simplement « non classées ». -->
<template>
    <div class="page">
        <h1>Toutes les catégories</h1>

        <!-- Formulaire de création, visible de l'administratrice seule. -->
        <form v-if="estAdmin" class="ajout" @submit.prevent="creer">
            <div class="ajout-ligne">
                <input v-model="nouveau" type="text" maxlength="100"
                       placeholder="Nouvelle catégorie (ex. Pochons)"
                       @input="erreur = ''" />
                <button type="submit" :disabled="!nouveau.trim() || occupe">Ajouter</button>
            </div>
            <label class="case">
                <input v-model="nouveauMasque" type="checkbox" />
                Masquée aux autres membres — vous seule la verrez, jusqu'à ce que
                vous la rendiez visible.
            </label>
        </form>

        <p v-if="erreur" class="erreur">{{ erreur }}</p>

        <div v-if="categories.length || sansCategorie" class="grille">
            <div v-for="c in categories" :key="c.id" class="carte">
                <!-- Une seule catégorie est renommable à la fois : `renommeId` retient
                     laquelle. Cette carte affiche alors un champ de saisie à la place du
                     lien — Entrée valide, Échap annule. -->
                <template v-if="renommeId === c.id">
                    <input v-model="renommeNom" type="text" maxlength="100" class="champ-renomme"
                           @keyup.enter="validerRenommage(c)" @keyup.esc="renommeId = null" />
                    <div class="actions">
                        <button class="btn-ok" @click="validerRenommage(c)">Valider</button>
                        <button class="btn-gris" @click="renommeId = null">Annuler</button>
                    </div>
                </template>

                <template v-else>
                    <RouterLink :to="{ path: '/galerie', query: { categorie: c.nom } }" class="lien">
                        <span class="nom">
                            {{ c.nom }}
                            <span v-if="!c.visible" class="badge-masquee" title="Visible de vous seule">
                                Masquée
                            </span>
                        </span>
                        <span class="nombre">
                            {{ c.nombre }} création{{ c.nombre > 1 ? 's' : '' }}
                        </span>
                    </RouterLink>
                    <!-- Bascule masquer / rendre visible. -->
                    <div v-if="estAdmin" class="actions actions-visibilite">
                        <button class="btn-visibilite" @click="basculer(c)">
                            {{ c.visible ? 'Masquer' : 'Rendre visible' }}
                        </button>
                    </div>
                    <div v-if="estAdmin" class="actions">
                        <button class="btn-gris" @click="ouvrirRenommage(c)">Renommer</button>
                        <button class="btn-rouge" @click="supprimer(c)">Supprimer</button>
                    </div>
                </template>
            </div>

            <RouterLink
                v-if="sansCategorie"
                :to="{ path: '/galerie', query: { categorie: 'sans' } }"
                class="carte carte-sans"
            >
                <span class="nom">Non classées</span>
                <span class="nombre">
                    {{ sansCategorie }} création{{ sansCategorie > 1 ? 's' : '' }}
                </span>
            </RouterLink>
        </div>

        <p v-else class="etat">
            Aucune catégorie pour le moment.
            <span v-if="estAdmin">Créez-en une ci-dessus.</span>
        </p>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api, estAdmin, categories, sansCategorie, chargerCategories, basculerVisibilite } from '../stores/auth.js'

const nouveau       = ref('')
const nouveauMasque = ref(false)
const erreur        = ref('')
const occupe        = ref(false)
const renommeId     = ref(null)  // identifiant de la catégorie en cours de renommage
const renommeNom    = ref('')

onMounted(chargerCategories)


// Crée la catégorie, éventuellement masquée dès le départ, puis
// recharge la liste partagée pour que le menu se mette à jour aussi.
async function creer() {
    erreur.value = ''
    occupe.value = true
    try {
        const res = await api('/api/categories', {
            method: 'POST',
            body:   JSON.stringify({ nom: nouveau.value, visible: !nouveauMasque.value })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            // Sans `erreur` dans la réponse, le serveur n'a pas répondu ce
            // qu'on attendait : mieux vaut le dire que rester vague.
            erreur.value = data.erreur
                || `Création impossible (erreur ${res.status}). Le serveur n'est peut-être pas à jour.`
            return
        }
        nouveau.value       = ''
        nouveauMasque.value = false
        await chargerCategories()
    } catch {
        erreur.value = 'Erreur de connexion au serveur'
    } finally {
        occupe.value = false
    }
}

/* --- Les deux messages de confirmation ------------------------------- *
 *
 * Masquer et supprimer n'ont rien à voir : le premier ne touche à rien,
 * le second efface la catégorie mais garde ses créations. Les messages
 * prennent soin de le dire, pour qu'on n'hésite pas à s'en servir.
 *
 * Les accords changent selon le nombre de créations. Plutôt que des
 * ternaires au milieu du texte, chaque morceau variable reçoit son nom :
 * le message se relit alors comme une phrase.
 */

function messageDeMasquage(categorie) {
    const plusieurs   = categorie.nombre > 1
    const creations   = `${categorie.nombre} création${plusieurs ? 's' : ''}`
    const disparaitre = plusieurs ? 'disparaîtront' : 'disparaîtra'
    const lesVoir     = plusieurs ? 'les' : 'la'

    return `Masquer la catégorie « ${categorie.nom} » ?\n\n`
        + `Ses ${creations} ${disparaitre} de la galerie des autres membres. `
        + `Vous continuerez à ${lesVoir} voir, et vous pourrez rendre `
        + `la catégorie visible à tout moment. Rien n'est supprimé.`
}


function messageDeSuppression(categorie) {
    const question = `Supprimer la catégorie « ${categorie.nom} » ?`

    // Une catégorie vide ne mérite pas d'explication.
    if (!categorie.nombre) return question

    const plusieurs = categorie.nombre > 1
    const creations = `${categorie.nombre} création${plusieurs ? 's' : ''}`
    const devenir   = plusieurs ? 'deviendront' : 'deviendra'
    const classees  = `« non classée${plusieurs ? 's' : ''} »`

    return `${question}\n\n${creations} ${devenir} ${classees}. `
        + `Aucune création n'est supprimée.`
}


// Masquer n'efface rien : les créations restent en place, elles cessent
// simplement d'apparaître pour les autres membres. On ne demande
// confirmation que s'il y a quelque chose à masquer.
async function basculer(c) {
    erreur.value = ''
    if (c.visible && c.nombre && !confirm(messageDeMasquage(c))) return

    try {
        await basculerVisibilite(c.id, !c.visible)
    } catch (e) {
        erreur.value = e.message
    }
}


// Bascule cette carte en saisie, avec le nom actuel comme point de départ.
function ouvrirRenommage(c) {
    renommeId.value  = c.id
    renommeNom.value = c.nom
    erreur.value     = ''
}


// Envoie le nouveau nom ; le serveur met à jour les créations concernées.
async function validerRenommage(c) {
    if (!renommeNom.value.trim()) return
    erreur.value = ''
    const res = await api(`/api/categories/${c.id}`, {
        method: 'PUT',
        body:   JSON.stringify({ nom: renommeNom.value })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { erreur.value = data.erreur || 'Renommage impossible'; return }
    renommeId.value = null
    await chargerCategories()
}

async function supprimer(c) {
    if (!confirm(messageDeSuppression(c))) return

    erreur.value = ''
    const res = await api(`/api/categories/${c.id}`, { method: 'DELETE' })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        erreur.value = data.erreur || 'Suppression impossible'
        return
    }
    await chargerCategories()
}
</script>

<style scoped>
/* « scoped » : ces règles ne valent que pour ce fichier. Vue ajoute
   discrètement un marqueur à chaque balise du composant et le reprend
   dans chaque sélecteur, ce qui évite qu'un `.page` défini ici déteigne
   sur une autre vue portant la même classe.
   */
.page {
    padding: 70px 20px 40px;
    min-height: 100vh;
    max-width: 900px;
    margin: 0 auto;
}
h1 { text-align: center; color: #333; margin-bottom: 28px; }
.ajout {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 460px;
    margin: 0 auto 24px;
}
.ajout-ligne { display: flex; gap: 10px; }
.case {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.82rem;
    color: #777;
    line-height: 1.4;
    cursor: pointer;
}
.case input { margin-top: 2px; flex-shrink: 0; cursor: pointer; }
.ajout input {
    flex: 1;
    padding: 11px 14px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
}
.ajout input:focus { border-color: #3355cc; }
.ajout button {
    padding: 11px 20px;
    background: #3355cc;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
.ajout button:hover:not(:disabled) { background: #2244bb; }
.ajout button:disabled { background: #aaa; cursor: default; }

.grille {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 16px;
}
.carte {
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.09);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
}
.carte:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.14); }
.lien { text-decoration: none; display: flex; flex-direction: column; gap: 4px; }
.nom {
    font-size: 1.05rem;
    font-weight: 600;
    color: #222;
    overflow-wrap: anywhere;
}
.nombre { font-size: 0.85rem; color: #777; }
.carte-sans .nom { font-style: italic; color: #666; }
.badge-masquee {
    display: inline-block;
    vertical-align: middle;
    margin-left: 6px;
    padding: 2px 8px;
    border-radius: 10px;
    background: #f0e6fb;
    color: #6b3fa0;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
}

.actions { display: flex; gap: 8px; margin-top: auto; }
/* Séparée des deux autres : masquer n'est pas du même ordre que
   renommer ou supprimer, et le libellé change selon l'état. */
.actions-visibilite { margin-bottom: -2px; }
.btn-visibilite {
    flex: 1;
    padding: 7px 10px;
    border: 1px solid #d9c8f0;
    border-radius: 6px;
    background: #f7f1fe;
    color: #6b3fa0;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-visibilite:hover { background: #efe3fc; }
.actions button {
    flex: 1;
    padding: 7px 10px;
    border: none;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-gris  { background: #eceef5; color: #444; }
.btn-gris:hover  { background: #dfe2ec; }
.btn-rouge { background: #fdecec; color: #c53030; }
.btn-rouge:hover { background: #f9d5d5; }
.btn-ok    { background: #3355cc; color: white; }
.btn-ok:hover { background: #2244bb; }
.champ-renomme {
    padding: 9px 11px;
    border: 2px solid #3355cc;
    border-radius: 6px;
    font-size: 0.95rem;
    outline: none;
    width: 100%;
}
.etat { text-align: center; color: #888; margin-top: 40px; }
.erreur { text-align: center; color: #e53e3e; font-size: 0.9rem; margin-bottom: 16px; }
</style>
