<!-- ===================================================================
      InscriptionView.vue — création d'un compte membre
     ===================================================================

      Le champ « code d'invitation » n'apparaît que si le serveur en
      réclame un (réglage INVITATION_CODE). Le nouveau compte est de type
      « PA » : membre invité, sans droit de modification. -->
<template>
    <div class="inscription-page">
        <div class="inscription-card">
            <h1>Inscription</h1>
            <form @submit.prevent="sInscrire">
                <div class="champ">
                    <label>Nom</label>
                    <input v-model="nom" type="text" placeholder="Votre nom" required />
                </div>
                <div class="champ">
                    <label>Prénom</label>
                    <input v-model="prenom" type="text" placeholder="Votre prénom" required />
                </div>
                <div class="champ">
                    <label>Email</label>
                    <input v-model="mail" type="email" placeholder="votre@email.com" required />
                </div>
                <div class="champ">
                    <label>Confirmation email</label>
                    <input v-model="mailConfirm" type="email" placeholder="votre@email.com" required />
                </div>
                <div class="champ">
                    <label>Mot de passe</label>
                    <div class="input-oeil">
                        <input v-model="motDePasse" :type="voirMdp ? 'text' : 'password'" placeholder="••••••••" required />
                        <button type="button" class="btn-oeil" @click="voirMdp = !voirMdp">
                            <IconeOeil :barre="voirMdp" />
                        </button>
                    </div>
                </div>
                <!-- Champ affiché seulement si le serveur exige un code. -->
                <div v-if="codeRequis" class="champ">
                    <label>Code d'invitation</label>
                    <input v-model="codeInvitation" type="text" placeholder="Code reçu avec le lien" required />
                    <p class="aide">Ce code vous a été communiqué par Manuela avec l'adresse du site.</p>
                </div>
                <p v-if="erreur" class="erreur">{{ erreur }}</p>
                <p v-if="succes" class="succes">{{ succes }}</p>
                <button type="submit" :disabled="chargement">
                    {{ chargement ? 'Inscription...' : "S'inscrire" }}
                </button>
                <p class="lien">Déjà inscrit ? <RouterLink to="/login">Se connecter</RouterLink></p>
            </form>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import IconeOeil from '../components/IconeOeil.vue'

const router     = useRouter()
const nom        = ref('')
const prenom     = ref('')
const mail       = ref('')
const mailConfirm = ref('')
const motDePasse = ref('')
const erreur     = ref('')
const succes     = ref('')
const chargement = ref(false)
const voirMdp    = ref(false)
const codeInvitation = ref('')
const codeRequis     = ref(false)

// À l'ouverture, on demande au serveur si un code est exigé, pour
// afficher ou non le champ.
onMounted(async () => {
    try {
        const res = await fetch('/api/inscription/config')
        codeRequis.value = (await res.json()).codeRequis
    } catch {
        // Serveur injoignable : le champ reste masqué, l'inscription
        // échouera de toute façon et affichera l'erreur.
    }
})


// Vérifie la concordance des deux adresses, envoie l'inscription, puis
// renvoie vers la connexion.
async function sInscrire() {
    erreur.value = ''
    succes.value = ''
    if (mail.value !== mailConfirm.value) {
        erreur.value = 'Les adresses email ne correspondent pas'
        return
    }
    chargement.value = true

    // Chaque champ du formulaire est une `ref` : on lit sa `.value` une
    // fois ici, plutôt que cinq fois dans le corps de la requête.
    const inscription = {
        nom:            nom.value,
        prenom:         prenom.value,
        mail:           mail.value,
        motDePasse:     motDePasse.value,
        codeInvitation: codeInvitation.value
    }

    try {
        const res = await fetch('/api/inscription', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(inscription)
        })
        const data = await res.json()
        if (!res.ok) {
            erreur.value = data.erreur || "Erreur lors de l'inscription"
        } else {
            succes.value = 'Inscription réussie ! Redirection vers la connexion...'
            setTimeout(() => router.push('/login'), 1500)
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
   */
.inscription-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f4f4f4;
    font-family: Arial, sans-serif;
}
.inscription-card {
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
    margin-bottom: 28px;
    font-size: 1.8rem;
}
form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
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
    margin-top: 4px;
}
button:hover:not(:disabled) { background-color: #2244bb; }
button:disabled { background-color: #aaa; cursor: default; }
.erreur {
    color: #e53e3e;
    font-size: 0.9rem;
    text-align: center;
}
.aide {
    color: #888;
    font-size: 0.78rem;
    margin-top: 2px;
}
.succes {
    color: #38a169;
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
