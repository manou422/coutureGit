<!-- ===================================================================
      ModifierView.vue — modifier une création existante
     ===================================================================

      Très proche de AjouterView, avec une difficulté en plus : les photos
      déjà en base. On veut pouvoir en retirer, en ajouter et changer leur
      ordre, sans retélécharger ni renvoyer celles qui n'ont pas bougé.

      D'où la liste `elements`, où cohabitent deux sortes de photos :
        - celles déjà en base : on ne garde que leur identifiant ;
        - les nouvelles : on garde l'image complète, à envoyer. -->
<template>
    <div class="modifier">
        <h1>Modifier la création</h1>

        <form v-if="photo" @submit.prevent="sauvegarder" class="formulaire">
            <div class="champ">
                <label>Titre</label>
                <input v-model="titre" type="text" required />
            </div>

            <div class="champ">
                <label>Catégorie <span class="optionnel">(facultatif)</span></label>
                <input v-model="categorie" type="text" list="categories-existantes"
                       placeholder="Pochons, Trousses, Sacs..." maxlength="100" />
                <datalist id="categories-existantes">
                    <option v-for="c in categories" :key="c.nom" :value="c.nom" />
                </datalist>
                <p v-if="categorieMasquee" class="avertissement">
                    Cette catégorie est masquée : la création ne sera visible que par vous,
                    jusqu'à ce que vous rendiez la catégorie visible.
                </p>
            </div>

            <div class="champ">
                <label>Description</label>
                <textarea v-model="description" rows="4"></textarea>
            </div>

            <div class="champ">
                <label>Photos <span class="optionnel">({{ elements.length }} sur 12)</span></label>

                <div v-if="elements.length" class="apercus">
                    <div v-for="(el, i) in elements" :key="el.cle" class="apercu-item">
                        <img v-if="el.url" :src="el.url" alt="" />
                        <span v-else class="attente"></span>
                        <span v-if="i === 0" class="badge-couverture">Couverture</span>
                        <button type="button" class="retirer" :aria-label="`Retirer la photo ${i + 1}`"
                                @click="retirer(i)">×</button>
                        <!-- La flèche ↑ fait passer une photo en première position, donc en couverture. -->
                        <button v-if="i > 0" type="button" class="promouvoir"
                                aria-label="Mettre en couverture" title="Mettre en couverture"
                                @click="promouvoir(i)">↑</button>
                    </div>
                </div>
                <p v-else class="poids">Aucune photo. Ajoutez-en au moins une.</p>

                <input type="file" accept="image/*" multiple @change="ajouterFichiers" class="fichier" />
                <p v-if="chargementPhotos" class="poids">Optimisation en cours...</p>
            </div>

            <button type="submit" :disabled="!elements.length || chargementPhotos">Enregistrer</button>
            <p v-if="erreur" class="erreur">{{ erreur }}</p>
            <p v-if="succes" class="succes">Modifications enregistrées !</p>
        </form>

        <p v-else>Chargement...</p>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, urlPhoto, categories, chargerCategories } from '../stores/auth.js'
import { redimensionner } from '../utils/image.js'

const LIMITE = 12

// Le serveur reconnaît ce préfixe : « conserver:42 » désigne la photo 42
// déjà en base, qu'il n'y a donc pas à renvoyer — seul son rang change.
// Voir « Le protocole conserver: » dans server.js.
const PREFIXE_CONSERVER = 'conserver:'

const route  = useRoute()
const router = useRouter()

const photo       = ref(null)
const titre       = ref('')
const description = ref('')
const categorie   = ref('')
const succes      = ref(false)
const erreur      = ref('')
const chargementPhotos = ref(false)

// Ranger une création dans une catégorie masquée la masque aussi : mieux
// vaut le dire au moment du choix qu'après coup.
const categorieMasquee = computed(() =>
    categories.value.some(c => c.nom === categorie.value.trim() && !c.visible))

// La liste affichée, dans son ordre actuel. Chaque élément est soit une
// photo déjà en base (on garde son id, sans la retéléverser), soit une
// nouvelle image en attente d'envoi.
//
// Chaque élément porte une `cle` stable — indispensable au `v-for` pour
// suivre les photos quand on les réordonne, sinon Vue confondrait les
// aperçus.
const elements = ref([])
let compteur = 0  // sert à fabriquer une clé unique par nouvelle photo

// À l'ouverture : on charge la création, on remplit les champs, puis on
// récupère ses photos une à une pour les afficher en aperçu.
onMounted(async () => {
    chargerCategories()
    const res = await api(`/api/photos/${route.params.id}`)
    if (!res.ok) return
    photo.value       = await res.json()
    titre.value       = photo.value.titre
    description.value = photo.value.description
    categorie.value   = photo.value.categorie || ''

    elements.value = photo.value.images.map(img => ({
        cle: `existante-${img.id}`, existanteId: img.id, url: null
    }))
    for (const el of elements.value) {
        el.url = await urlPhoto(el.existanteId)
    }
})

onUnmounted(() => {
    for (const el of elements.value) {
        if (el.existanteId && el.url) URL.revokeObjectURL(el.url)
    }
})

async function ajouterFichiers(e) {
    const fichiers = Array.from(e.target.files || [])
    if (!fichiers.length) return
    erreur.value = ''
    chargementPhotos.value = true
    try {
        for (const fichier of fichiers) {
            if (elements.value.length >= LIMITE) {
                erreur.value = `${LIMITE} photos au maximum par création`
                break
            }
            const donnees = await redimensionner(fichier)
            elements.value.push({ cle: `nouvelle-${compteur++}`, donnees, url: donnees })
        }
    } catch (err) {
        erreur.value = err.message
    } finally {
        chargementPhotos.value = false
        e.target.value = ''
    }
}

function retirer(i) {
    const el = elements.value[i]
    if (el.existanteId && el.url) URL.revokeObjectURL(el.url)
    elements.value.splice(i, 1)
}


// `splice` retire la photo de sa place, `unshift` la remet en tête.
function promouvoir(i) {
    const [el] = elements.value.splice(i, 1)
    elements.value.unshift(el)
}


// Envoie le tout. La liste transmise décrit l'ordre voulu ; le serveur
// s'aligne dessus (voir la route PUT /api/photos/:id).
async function sauvegarder() {
    erreur.value = ''

    // La liste envoyée décrit l'ordre voulu. Une photo déjà en base y
    // figure sous la forme « conserver:<id> », une nouvelle sous celle de
    // son image complète.
    const photos = elements.value.map(element => element.existanteId
        ? `${PREFIXE_CONSERVER}${element.existanteId}`
        : element.donnees)
    const res = await api(`/api/photos/${route.params.id}`, {
        method: 'PUT',
        body:   JSON.stringify({
            titre: titre.value, description: description.value,
            categorie: categorie.value, photos
        })
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        erreur.value = data.erreur || 'Erreur lors de l\'enregistrement'
        return
    }
    succes.value = true
    setTimeout(() => router.push('/galerie'), 1200)
}
</script>

<style scoped>
/* « scoped » : ces règles ne valent que pour ce fichier. Vue ajoute
   discrètement un marqueur à chaque balise du composant et le reprend
   dans chaque sélecteur, ce qui évite qu'un `.page` défini ici déteigne
   sur une autre vue portant la même classe.
   */
.modifier {
    padding: 90px 20px 40px;
    min-height: 100vh;
    font-family: Arial, sans-serif;
    background-color: #f4f4f4;
    display: flex;
    flex-direction: column;
    align-items: center;
}
h1 { margin-bottom: 32px; color: #333; font-size: 1.6rem; }
.formulaire {
    background: white;
    padding: 32px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}
.champ { display: flex; flex-direction: column; gap: 6px; }
label { font-weight: 600; color: #444; font-size: 0.9rem; }
.optionnel { font-weight: 400; color: #999; font-size: 0.8rem; }
.avertissement {
    font-size: 0.82rem;
    color: #6b3fa0;
    background: #f7f1fe;
    border-radius: 6px;
    padding: 8px 10px;
    margin-top: 6px;
    line-height: 1.4;
}
input[type=text], textarea {
    padding: 11px 14px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
}
input[type=text]:focus, textarea:focus { border-color: #3355cc; }
.fichier { margin-top: 10px; font-size: 0.9rem; }
.apercus {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 10px;
}
.apercu-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #f0f0f0;
}
.apercu-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.attente {
    display: block;
    width: 100%;
    height: 100%;
    background: linear-gradient(100deg, #e8e8e8 30%, #f4f4f4 50%, #e8e8e8 70%);
    background-size: 200% 100%;
    animation: glisse 1.2s ease-in-out infinite;
}
@keyframes glisse {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) { .attente { animation: none; } }
.badge-couverture {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.62);
    color: white;
    font-size: 0.66rem;
    font-weight: 600;
    text-align: center;
    padding: 2px 0;
}
.retirer, .promouvoir {
    position: absolute;
    top: 4px;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.62);
    color: white;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
}
.retirer { right: 4px; }
.retirer:hover { background: #e53e3e; }
.promouvoir { left: 4px; font-size: 0.85rem; }
.promouvoir:hover { background: #3355cc; }
button[type=submit] {
    padding: 12px;
    background: #3355cc;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
button[type=submit]:hover:not(:disabled) { background: #2244bb; }
button[type=submit]:disabled { background: #aaa; cursor: default; }
.poids { font-size: 0.82rem; color: #777; }
.succes { text-align: center; color: #38a169; font-weight: 600; }
.erreur { text-align: center; color: #e53e3e; font-weight: 600; }
</style>
