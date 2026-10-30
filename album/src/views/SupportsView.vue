<!-- ===================================================================
      SupportsView.vue — « Supports utilisés »
     ===================================================================

      D'où viennent les modèles : un livre, un magazine, un site. Chaque
      support porte le nombre de projets qui en ont été tirés — un même
      ouvrage en fournit souvent plusieurs.

      Ce nombre est saisi à la main et non compté depuis les créations :
      rien ne relie une création à son support en base, et un livre a pu
      servir bien avant que l'album n'existe. Le bouton « +1 » est là
      pour le geste courant, celui qu'on fait en terminant un projet.

      Les membres voient la liste ; l'administratrice seule ajoute,
      modifie et supprime. Comme ailleurs, cacher les boutons n'est qu'un
      confort : c'est le serveur qui refuse pour de bon. -->
<template>
    <div class="page">
        <h1>Supports utilisés</h1>

        <p v-if="supports.length" class="resume">
            {{ totalProjets }} projet{{ totalProjets > 1 ? 's' : '' }}
            réalisé{{ totalProjets > 1 ? 's' : '' }} à partir de
            {{ supports.length }} support{{ supports.length > 1 ? 's' : '' }}
        </p>

        <!-- Formulaire d'ajout, visible de l'administratrice seule. -->
        <form v-if="estAdmin" class="ajout" @submit.prevent="creer">
            <div class="ajout-ligne">
                <input v-model="nom" type="text" maxlength="255" class="champ-nom"
                       placeholder="Titre du livre, du magazine ou du site"
                       @input="erreur = ''" />
                <select v-model="type" class="champ-type">
                    <option v-for="t in TYPES" :key="t.valeur" :value="t.valeur">
                        {{ t.libelle }}
                    </option>
                </select>
            </div>
            <div class="ajout-ligne">
                <label class="champ-nombre">
                    Projets réalisés
                    <input v-model.number="nombre" type="number" min="0" max="9999" />
                </label>
                <!-- Le lien ne sert qu'aux sites : un nom sans adresse n'y
                     mènerait à rien. Pour un livre, le champ n'a pas lieu d'être. -->
                <input v-if="type === 'site'" v-model="lien" type="url" maxlength="500"
                       class="champ-lien" placeholder="https://..." />
                <button type="submit" :disabled="!nom.trim() || occupe">Ajouter</button>
            </div>
        </form>

        <p v-if="erreur" class="erreur">{{ erreur }}</p>

        <div v-if="supports.length" class="grille">
            <div v-for="s in supports" :key="s.id" class="carte">
                <!-- Un seul support se modifie à la fois : `modifieId` retient
                     lequel. Sa carte affiche alors ses champs à la place du
                     texte — Échap annule. -->
                <template v-if="modifieId === s.id">
                    <input v-model="formNom" type="text" maxlength="255" class="champ-renomme"
                           @keyup.esc="annulerModification" />
                    <div class="ligne-edition">
                        <select v-model="formType">
                            <option v-for="t in TYPES" :key="t.valeur" :value="t.valeur">
                                {{ t.libelle }}
                            </option>
                        </select>
                        <label class="champ-nombre">
                            Projets
                            <input v-model.number="formNombre" type="number" min="0" max="9999" />
                        </label>
                    </div>
                    <input v-if="formType === 'site'" v-model="formLien" type="url" maxlength="500"
                           class="champ-renomme" placeholder="https://..." />
                    <div class="actions">
                        <button class="btn-ok" @click="validerModification(s)">Valider</button>
                        <button class="btn-gris" @click="annulerModification">Annuler</button>
                    </div>
                </template>

                <template v-else>
                    <span class="nom">
                        {{ s.nom }}
                        <span class="badge" :class="`badge-${s.type}`">{{ libelleDuType(s.type) }}</span>
                    </span>

                    <!-- `rel="noopener noreferrer"` : sans lui, la page ouverte
                         garderait une prise sur celle-ci. -->
                    <a v-if="s.lien" :href="s.lien" class="lien-site"
                       target="_blank" rel="noopener noreferrer">
                        Ouvrir le site
                    </a>

                    <span class="nombre">
                        {{ s.nombre }} projet{{ s.nombre > 1 ? 's' : '' }}
                    </span>

                    <div v-if="estAdmin" class="actions">
                        <button class="btn-plus" :disabled="occupe"
                                title="Un projet de plus tiré de ce support"
                                @click="incrementer(s)">+1</button>
                        <button class="btn-gris" @click="ouvrirModification(s)">Modifier</button>
                        <button class="btn-rouge" @click="supprimer(s)">Supprimer</button>
                    </div>
                </template>
            </div>
        </div>

        <p v-else class="etat">
            Aucun support pour le moment.
            <span v-if="estAdmin">Ajoutez-en un ci-dessus.</span>
        </p>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { estAdmin } from '../stores/auth.js'
import {
    supports, TYPES, libelleDuType,
    chargerSupports, ajouterSupport, modifierSupport, supprimerSupport
} from '../stores/supports.js'

// Le formulaire d'ajout.
const nom    = ref('')
const type   = ref('livre')
const nombre = ref(0)
const lien   = ref('')

const erreur = ref('')
const occupe = ref(false)

// La carte en cours de modification, et ses champs.
const modifieId  = ref(null)
const formNom    = ref('')
const formType   = ref('livre')
const formNombre = ref(0)
const formLien   = ref('')

// Le total affiché en tête. `nombre` est déjà un entier côté serveur.
const totalProjets = computed(() =>
    supports.value.reduce((somme, s) => somme + s.nombre, 0))

onMounted(chargerSupports)


async function creer() {
    erreur.value = ''
    occupe.value = true
    try {
        await ajouterSupport({
            nom:    nom.value,
            type:   type.value,
            nombre: nombre.value,
            lien:   lien.value
        })
        nom.value    = ''
        nombre.value = 0
        lien.value   = ''
    } catch (e) {
        erreur.value = e.message
    } finally {
        occupe.value = false
    }
}


function ouvrirModification(support) {
    erreur.value     = ''
    modifieId.value  = support.id
    formNom.value    = support.nom
    formType.value   = support.type
    formNombre.value = support.nombre
    formLien.value   = support.lien || ''
}

function annulerModification() {
    modifieId.value = null
}

async function validerModification(support) {
    erreur.value = ''
    occupe.value = true
    try {
        await modifierSupport(support.id, {
            nom:    formNom.value,
            type:   formType.value,
            nombre: formNombre.value,
            lien:   formLien.value
        })
        modifieId.value = null
    } catch (e) {
        erreur.value = e.message
    } finally {
        occupe.value = false
    }
}


// Le geste courant : un projet de plus tiré de ce support. On renvoie le
// support entier, le serveur attendant toujours son nom et son type.
async function incrementer(support) {
    erreur.value = ''
    occupe.value = true
    try {
        await modifierSupport(support.id, {
            nom:    support.nom,
            type:   support.type,
            nombre: support.nombre + 1,
            lien:   support.lien || ''
        })
    } catch (e) {
        erreur.value = e.message
    } finally {
        occupe.value = false
    }
}


// Supprimer un support n'efface aucune création : rien ne les relie. Le
// message le dit, pour qu'on n'hésite pas.
async function supprimer(support) {
    const projets = support.nombre > 1
        ? `les ${support.nombre} projets qui en sont tirés`
        : 'le projet qui en est tiré'
    const message = support.nombre
        ? `Retirer « ${support.nom} » de la liste des supports ?\n\n`
          + `Vos créations ne sont pas touchées : ${projets} restent dans l'album. `
          + `Seul le support disparaît de cette page.`
        : `Retirer « ${support.nom} » de la liste des supports ?`

    if (!confirm(message)) return

    erreur.value = ''
    try {
        await supprimerSupport(support.id)
    } catch (e) {
        erreur.value = e.message
    }
}
</script>

<style scoped>
/* Les mesures et les teintes sont celles de CategoriesView : les deux
   pages se suivent dans le menu et se ressemblent de près. */
.page {
    padding: 70px 20px 40px;
    min-height: 100vh;
    max-width: 760px;
    margin: 0 auto;
}
h1 {
    text-align: center;
    margin-bottom: 8px;
    color: #333;
}
.resume {
    text-align: center;
    color: #777;
    font-size: 0.9rem;
    margin-bottom: 24px;
}

/* --- Le formulaire d'ajout --- */
.ajout {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 24px;
}
.ajout-ligne {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
}
.champ-nom { flex: 1 1 240px; }
.champ-lien { flex: 1 1 200px; }
.ajout input[type="text"], .ajout input[type="url"], .ajout select {
    padding: 11px 14px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    outline: none;
    background: #fff;
    transition: border-color 0.2s;
}
.ajout input:focus, .ajout select:focus { border-color: #8e5c56; }
/* Le libellé entoure son champ : les deux restent solidaires quand la
   ligne se replie sur un écran étroit. */
.champ-nombre {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: #666;
    white-space: nowrap;
}
.champ-nombre input {
    width: 86px;
    padding: 11px 10px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    outline: none;
}
.champ-nombre input:focus { border-color: #8e5c56; }
.ajout button {
    padding: 11px 20px;
    background: #8e5c56;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.2s;
}
.ajout button:hover:not(:disabled) { background: #74463f; }
.ajout button:disabled { background: #bbb; cursor: default; }

/* --- La liste --- */
.grille {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.carte {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    background: #fff;
    border: 1px solid #ece3df;
    border-radius: 10px;
    padding: 14px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.nom {
    flex: 1 1 200px;
    font-weight: 600;
    color: #444;
    font-size: 0.98rem;
}
.badge {
    display: inline-block;
    vertical-align: middle;
    margin-left: 8px;
    padding: 2px 9px;
    border-radius: 12px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
}
/* Une teinte par type : on repère le genre d'un support d'un coup d'œil,
   sans lire l'étiquette. */
.badge-livre    { background: #efe4fb; color: #6b3fa0; }
.badge-magazine { background: #fbe9e4; color: #a0533f; }
.badge-site     { background: #e2eff0; color: #2f6b70; }

.lien-site {
    font-size: 0.82rem;
    color: #8e5c56;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
}
.lien-site:hover { text-decoration: underline; }

.nombre {
    font-size: 0.82rem;
    color: #666;
    background: #f6f1ef;
    padding: 4px 11px;
    border-radius: 12px;
    white-space: nowrap;
}

.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.actions button {
    padding: 7px 12px;
    border: none;
    border-radius: 7px;
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-plus   { background: #e8ddd9; color: #6b4a45; font-weight: 700; }
.btn-plus:hover:not(:disabled) { background: #dbcbc6; }
.btn-plus:disabled { opacity: 0.5; cursor: default; }
.btn-gris   { background: #eee; color: #555; }
.btn-gris:hover { background: #e2e2e2; }
.btn-rouge  { background: #fbe9e7; color: #c0392b; }
.btn-rouge:hover { background: #f7d9d5; }
.btn-ok     { background: #8e5c56; color: #fff; font-weight: 600; }
.btn-ok:hover { background: #74463f; }

/* --- La carte en cours de modification --- */
.champ-renomme {
    flex: 1 1 100%;
    padding: 9px 12px;
    border: 2px solid #8e5c56;
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: inherit;
    outline: none;
}
.ligne-edition {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
}
.ligne-edition select {
    padding: 9px 12px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 0.9rem;
    font-family: inherit;
    background: #fff;
    outline: none;
}
.ligne-edition .champ-nombre input { width: 80px; padding: 9px 10px; }

.erreur {
    color: #c0392b;
    font-size: 0.88rem;
    text-align: center;
    margin-bottom: 14px;
}
.etat {
    text-align: center;
    color: #888;
    margin-top: 40px;
}
</style>
