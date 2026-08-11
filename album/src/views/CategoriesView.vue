<template>
    <div class="page">
        <h1>Toutes les catégories</h1>

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
const renommeId     = ref(null)
const renommeNom    = ref('')

onMounted(chargerCategories)

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

// Masquer n'efface rien : les créations restent en place, elles cessent
// simplement d'apparaître pour les autres membres. Le message le dit,
// pour qu'on n'hésite pas à s'en servir.
async function basculer(c) {
    erreur.value = ''
    if (c.visible && c.nombre) {
        const message = `Masquer la catégorie « ${c.nom} » ?\n\n`
            + `Ses ${c.nombre} création${c.nombre > 1 ? 's' : ''} `
            + `${c.nombre > 1 ? 'disparaîtront' : 'disparaîtra'} de la galerie des autres membres. `
            + `Vous continuerez à ${c.nombre > 1 ? 'les' : 'la'} voir, et vous pourrez rendre `
            + `la catégorie visible à tout moment. Rien n'est supprimé.`
        if (!confirm(message)) return
    }
    try {
        await basculerVisibilite(c.id, !c.visible)
    } catch (e) {
        erreur.value = e.message
    }
}

function ouvrirRenommage(c) {
    renommeId.value  = c.id
    renommeNom.value = c.nom
    erreur.value     = ''
}

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
    // Le message dit ce qui arrive aux créations : elles ne sont pas
    // supprimées, seulement déclassées.
    const message = c.nombre
        ? `Supprimer la catégorie « ${c.nom} » ?\n\n${c.nombre} création${c.nombre > 1 ? 's' : ''} deviendra${c.nombre > 1 ? 'ont' : ''} « non classée${c.nombre > 1 ? 's' : ''} ». Aucune création n'est supprimée.`
        : `Supprimer la catégorie « ${c.nom} » ?`
    if (!confirm(message)) return

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
