<!-- ===================================================================
      LoginView.vue — la page de connexion
     ===================================================================

      Premier écran pour qui n'est pas connecté : le routeur y renvoie
      toute personne demandant une page protégée. -->
<template>
    <div class="login-page">
        <div class="login-card">
            <h1>Connexion</h1>
            <form @submit.prevent="seConnecter">
                <div class="champ">
                    <label>Email</label>
                    <input v-model="email" type="email" placeholder="votre@email.com" required />
                </div>
                <div class="champ">
                    <label>Mot de passe</label>
                    <div class="input-oeil">
                        <input v-model="motDePasse" :type="voirMdp ? 'text' : 'password'" placeholder="••••••••" required />
                        <!-- L'œil affiche ou masque le mot de passe, en basculant simplement
                             le type du champ entre `password` et `text`. Le dessin lui-même
                             est dans components/IconeOeil.vue. -->
                        <button type="button" class="btn-oeil" @click="voirMdp = !voirMdp">
                            <IconeOeil :barre="voirMdp" />
                        </button>
                    </div>
                </div>
                <p v-if="erreur" class="erreur">{{ erreur }}</p>
                <button type="submit" :disabled="chargement">
                    {{ chargement ? 'Connexion...' : 'Se connecter' }}
                </button>
                <p class="lien"><RouterLink to="/mot-de-passe-oublie">Mot de passe oublié ?</RouterLink></p>
                <p class="lien">Pas encore inscrit ? <RouterLink to="/inscription">Créer un compte</RouterLink></p>
            </form>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import IconeOeil from '../components/IconeOeil.vue'
import { connecter, invaliderSynchro } from '../stores/auth.js'

const router     = useRouter()
const email      = ref('')
const motDePasse = ref('')
const erreur     = ref('')
const chargement = ref(false)  // vrai pendant l'appel : le bouton se désactive
const voirMdp    = ref(false)


// Envoie les identifiants. Cet appel utilise `fetch` directement, et
// non `api()` : il n'y a pas encore de jeton à joindre.
//
// En cas de succès : `connecter` range le profil et le jeton,
// `invaliderSynchro` force la prochaine page à relire le profil auprès
// du serveur, puis on va à l'accueil.
async function seConnecter() {
    erreur.value     = ''
    chargement.value = true
    try {
        const res  = await fetch('/api/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email: email.value, motDePasse: motDePasse.value })
        })
        const data = await res.json()
        if (!res.ok) {
            erreur.value = data.erreur || 'Identifiants incorrects'
        } else {
            connecter(data.utilisateur, data.token)
            invaliderSynchro()
            router.push('/')
        }
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

   La carte blanche est centrée par un `flex` occupant toute la hauteur
   de la fenêtre : c'est la mise en page des quatre écrans de connexion.
   */
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f4f4f4;
    font-family: Arial, sans-serif;
}
.login-card {
    background: white;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    width: 100%;
    max-width: 400px;
}
h1 {
    text-align: center;
    color: #333;
    margin-bottom: 32px;
    font-size: 1.8rem;
}
form {
    display: flex;
    flex-direction: column;
    gap: 20px;
}
.champ {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
label {
    font-weight: 600;
    color: #444;
    font-size: 0.95rem;
}
input {
    padding: 12px 14px;
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
button {
    padding: 12px;
    background-color: #3355cc;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
button:hover:not(:disabled) { background-color: #2244bb; }
button:disabled { background-color: #aaa; cursor: default; }
.erreur {
    color: #e53e3e;
    font-size: 0.9rem;
    text-align: center;
}
.lien {
    text-align: center;
    font-size: 0.9rem;
    color: #666;
}
.lien a {
    color: #3355cc;
    text-decoration: none;
    font-weight: 600;
}
.lien a:hover { text-decoration: underline; }
</style>
