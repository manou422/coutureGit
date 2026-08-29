<!-- ===================================================================
      ReinitialiserView.vue — choix du nouveau mot de passe
     ===================================================================

      Page atteinte par le lien reçu par email : /reinitialiser/<jeton>.
      Le jeton est simplement relayé au serveur, qui le vérifie. -->
<template>
    <div class="page">
        <div class="carte">
            <h1>Nouveau mot de passe</h1>

            <template v-if="!termine">
                <form @submit.prevent="valider">
                    <div class="champ">
                        <label>Nouveau mot de passe</label>
                        <div class="input-oeil">
                            <input v-model="motDePasse" :type="voirMdp ? 'text' : 'password'"
                                   placeholder="8 caractères minimum" required />
                            <button type="button" class="btn-oeil" @click="voirMdp = !voirMdp">
                                {{ voirMdp ? 'Cacher' : 'Voir' }}
                            </button>
                        </div>
                    </div>

                    <div class="champ">
                        <label>Confirmation</label>
                        <input v-model="confirmation" :type="voirMdp ? 'text' : 'password'"
                               placeholder="Retapez le mot de passe" required />
                    </div>

                    <p v-if="erreur" class="erreur">{{ erreur }}</p>

                    <button type="submit" :disabled="chargement">
                        {{ chargement ? 'Enregistrement...' : 'Valider' }}
                    </button>
                </form>
            </template>

            <!-- Une fois le mot de passe changé, le formulaire cède la place à ce message. -->
            <template v-else>
                <p class="succes">
                    Mot de passe modifié. Vous pouvez maintenant vous connecter.
                </p>
                <RouterLink to="/login" class="bouton-lien">Aller à la connexion</RouterLink>
            </template>

            <p v-if="!termine" class="lien">
                <RouterLink to="/login">Retour à la connexion</RouterLink>
            </p>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route        = useRoute()
const motDePasse   = ref('')
const confirmation = ref('')
const erreur       = ref('')
const chargement   = ref(false)
const termine      = ref(false)
const voirMdp      = ref(false)


// Deux vérifications ici (concordance et longueur) pour prévenir tout
// de suite ; le serveur revérifie la longueur de son côté, car un
// contrôle fait dans le navigateur peut toujours être contourné.
async function valider() {
    erreur.value = ''
    if (motDePasse.value !== confirmation.value) {
        erreur.value = 'Les deux mots de passe ne correspondent pas'
        return
    }
    if (motDePasse.value.length < 8) {
        erreur.value = 'Le mot de passe doit faire au moins 8 caractères'
        return
    }
    chargement.value = true
    try {
        const res  = await fetch('/api/reinitialiser', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            // `route.params.token` : le morceau de l'adresse déclaré `/:token` dans main.js.
            body:    JSON.stringify({ token: route.params.token, motDePasse: motDePasse.value })
        })
        const data = await res.json()
        if (!res.ok) erreur.value = data.erreur || 'Erreur lors de la réinitialisation'
        else termine.value = true
    } catch {
        erreur.value = 'Erreur de connexion au serveur'
    } finally {
        chargement.value = false
    }
}
</script>

<style scoped>
/* « scoped » : ces règles ne valent que pour ce fichier. Vue ajoute
   discrètement un marqueur à chaque balise du composant et le reprend
   dans chaque sélecteur, ce qui évite qu'un `.page` défini ici déteigne
   sur une autre vue portant la même classe.
   */
.page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f4f4f4;
    font-family: Arial, sans-serif;
    padding: 20px;
}
.carte {
    background: white;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    width: 100%;
    max-width: 420px;
}
h1 {
    text-align: center;
    color: #333;
    margin-bottom: 24px;
    font-size: 1.6rem;
}
form { display: flex; flex-direction: column; gap: 16px; }
.champ { display: flex; flex-direction: column; gap: 6px; }
label { font-weight: 600; color: #444; font-size: 0.9rem; }
input {
    padding: 11px 14px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    outline: none;
    width: 100%;
    transition: border-color 0.2s;
}
input:focus { border-color: #3355cc; }
.input-oeil { position: relative; display: flex; align-items: center; }
.input-oeil input { padding-right: 70px; }
.btn-oeil {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    color: #3355cc;
    font-size: 0.85rem;
    font-weight: 600;
    width: auto;
}
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
.bouton-lien {
    display: block;
    text-align: center;
    padding: 12px;
    background: #3355cc;
    color: white;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    margin-top: 20px;
}
.erreur { color: #e53e3e; font-size: 0.9rem; text-align: center; }
.succes { color: #38a169; font-size: 0.95rem; text-align: center; line-height: 1.5; }
.lien { text-align: center; margin-top: 20px; font-size: 0.9rem; }
.lien a { color: #3355cc; font-weight: 600; text-decoration: none; }
</style>
