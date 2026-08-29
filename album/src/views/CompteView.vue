<!-- ===================================================================
      CompteView.vue — « Mon compte »
     ===================================================================

      La page a deux visages : la fiche en lecture, et le formulaire de
      modification. `modeEdition` décide lequel est montré — c'est le rôle
      des `v-if` / `v-else` ci-dessous. -->
<template>
    <div class="compte-page">
        <div class="compte-card">
            <h1>Mon compte</h1>

            <!-- Premier visage : la fiche, en lecture seule. -->
            <div v-if="!modeEdition" class="infos">
                <div class="ligne">
                    <span class="label">Nom</span>
                    <span class="valeur">{{ utilisateur.nom }}</span>
                </div>
                <div class="ligne">
                    <span class="label">Prénom</span>
                    <span class="valeur">{{ utilisateur.prenom }}</span>
                </div>
                <div class="ligne">
                    <span class="label">Email</span>
                    <span class="valeur">{{ utilisateur.mail }}</span>
                </div>
                <!-- Le type n'est montré qu'à l'administratrice : « PA » ne dirait rien
                     aux membres. -->
                <div v-if="utilisateur.type !== 'PA'" class="ligne">
                    <span class="label">Type</span>
                    <span class="valeur badge" :class="utilisateur.type">{{ utilisateur.type }}</span>
                </div>
                <div class="ligne">
                    <span class="label">Connexions</span>
                    <span class="valeur">{{ utilisateur.nombreConnexion }}</span>
                </div>
            </div>

            <!-- Second visage : le formulaire, affiché à la place de la fiche. -->
            <form v-else @submit.prevent="sauvegarder" class="form-edition">
                <div class="champ">
                    <label>Nom</label>
                    <input v-model="form.nom" type="text" required />
                </div>
                <div class="champ">
                    <label>Prénom</label>
                    <input v-model="form.prenom" type="text" required />
                </div>
                <div class="champ">
                    <label>Email</label>
                    <input v-model="form.mail" type="email" required />
                </div>
                <div class="champ">
                    <!-- Champ facultatif : laissé vide, le mot de passe ne change pas. -->
                    <label>Nouveau mot de passe <span class="optionnel">(laisser vide pour ne pas changer)</span></label>
                    <div class="input-oeil">
                        <input v-model="form.motDePasse" :type="voirMdp ? 'text' : 'password'" placeholder="••••••••" />
                        <button type="button" class="btn-oeil" @click="voirMdp = !voirMdp">
                            <IconeOeil :barre="voirMdp" />
                        </button>
                    </div>
                </div>
                <p v-if="erreur" class="erreur">{{ erreur }}</p>
                <p v-if="succes" class="succes">{{ succes }}</p>
                <div class="btns-form">
                    <button type="submit" class="btn-sauvegarder" :disabled="chargement">
                        {{ chargement ? 'Enregistrement...' : 'Enregistrer' }}
                    </button>
                    <button type="button" class="btn-annuler" @click="annuler">Annuler</button>
                </div>
            </form>

            <p v-if="erreur && !modeEdition" class="erreur">{{ erreur }}</p>

            <div v-if="!modeEdition" class="btns-bas">
                <button class="btn-modifier" @click="ouvrirEdition">Modifier</button>
                <button class="btn-supprimer" @click="supprimerCompte">Supprimer le compte</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import IconeOeil from '../components/IconeOeil.vue'
import { api, connecter, deconnecter, rafraichir, utilisateur as utilisateurConnecte } from '../stores/auth.js'

const router     = useRouter()
const utilisateur = ref({})  // la fiche affichée, relue au serveur
const modeEdition = ref(false)
const erreur      = ref('')
const succes      = ref('')
const chargement  = ref(false)
const form        = ref({ nom: '', prenom: '', mail: '', motDePasse: '' })  // la copie en cours de modification
const voirMdp     = ref(false)

// On relit le profil au serveur plutôt que de croire le navigateur :
// il peut avoir changé depuis la dernière connexion.
onMounted(async () => {
    const data = await rafraichir()
    if (!data) return router.push('/login')
    utilisateur.value = data
})


// Passe en modification en recopiant la fiche dans `form`. On travaille
// sur une copie : « Annuler » se contente alors de la jeter.
function ouvrirEdition() {
    form.value = {
        nom:        utilisateur.value.nom,
        prenom:     utilisateur.value.prenom,
        mail:       utilisateur.value.mail,
        motDePasse: ''
    }
    erreur.value = ''
    succes.value = ''
    modeEdition.value = true
}

function annuler() {
    modeEdition.value = false
    erreur.value = ''
}


// Enregistre. En cas de succès, la fiche ET le profil global (celui du
// store, affiché ailleurs dans le site) sont mis à jour.
async function sauvegarder() {
    erreur.value = ''
    succes.value = ''
    chargement.value = true

    // Les quatre valeurs saisies, sorties une bonne fois du formulaire :
    // elles servent ensuite à trois endroits.
    const { nom, prenom, mail, motDePasse } = form.value

    try {
        const res = await api(`/api/utilisateurs/${utilisateur.value.id}`, {
            method: 'PUT',
            // Mot de passe vide = on n'y touche pas. `undefined` disparaît
            // du JSON envoyé, alors qu'une chaîne vide serait transmise.
            body: JSON.stringify({ nom, prenom, mail, motDePasse: motDePasse || undefined })
        })
        const data = await res.json()

        if (!res.ok) {
            erreur.value = data.erreur || 'Erreur lors de la modification'
        } else {
            // La fiche affichée ici...
            utilisateur.value = { ...utilisateur.value, nom, prenom, mail }
            // ...et le profil partagé, que le reste du site affiche.
            connecter({ ...utilisateurConnecte.value, nom, prenom, mail })

            succes.value = 'Modifications enregistrées'
            setTimeout(() => { modeEdition.value = false; succes.value = '' }, 1200)
        }
    } catch {
        erreur.value = 'Erreur de connexion au serveur'
    } finally {
        chargement.value = false
    }
}


// Supprime le compte après confirmation, puis renvoie à la connexion.
async function supprimerCompte() {
    if (!confirm('Supprimer définitivement votre compte ?')) return
    await api(`/api/utilisateurs/${utilisateur.value.id}`, { method: 'DELETE' })
    deconnecter()
    router.push('/login')
}
</script>

<style scoped>
/* « scoped » : ces règles ne valent que pour ce fichier. Vue ajoute
   discrètement un marqueur à chaque balise du composant et le reprend
   dans chaque sélecteur, ce qui évite qu'un `.page` défini ici déteigne
   sur une autre vue portant la même classe.
   */
.compte-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
}
.compte-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    padding: 40px;
    width: 100%;
    max-width: 460px;
}
h1 {
    text-align: center;
    color: #333;
    margin-bottom: 32px;
    font-size: 1.8rem;
}
.infos {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 32px;
}
.ligne {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f8f9ff;
    border-radius: 8px;
    border: 1px solid #e8ecff;
}
.label {
    font-weight: 600;
    color: #555;
    font-size: 0.95rem;
}
.valeur {
    color: #222;
    font-size: 0.95rem;
}
.badge {
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
}
.badge.admin { background: #e8f0ff; color: #3355cc; }
.badge.PA    { background: #e8fff0; color: #2a8a50; }
.form-edition {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 8px;
}
.champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
label {
    font-weight: 600;
    color: #444;
    font-size: 0.9rem;
}
.optionnel {
    font-weight: 400;
    color: #999;
    font-size: 0.8rem;
}
input {
    padding: 11px 14px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
}
input:focus { border-color: #3355cc; }
.input-oeil {
    position: relative;
    display: flex;
    align-items: center;
}
.input-oeil input {
    width: 100%;
    padding-right: 44px;
}
.btn-oeil {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #888;
    display: flex;
    align-items: center;
}
.btn-oeil:hover { color: #3355cc; background: none; }
.btn-oeil svg { width: 20px; height: 20px; }
.btns-form {
    display: flex;
    gap: 12px;
    margin-top: 4px;
}
.btn-sauvegarder {
    flex: 1;
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
.btn-sauvegarder:hover:not(:disabled) { background: #2244bb; }
.btn-sauvegarder:disabled { background: #aaa; cursor: default; }
.btn-annuler {
    flex: 1;
    padding: 12px;
    background: #f0f0f0;
    color: #444;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-annuler:hover { background: #e0e0e0; }
.btns-bas {
    display: flex;
    gap: 12px;
}
.btn-modifier {
    flex: 1;
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
.btn-modifier:hover { background: #2244bb; }
.btn-supprimer {
    flex: 1;
    padding: 12px;
    background: #e53e3e;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-supprimer:hover { background: #c53030; }
.erreur { color: #e53e3e; font-size: 0.9rem; text-align: center; }
.succes { color: #38a169; font-size: 0.9rem; text-align: center; }
</style>
