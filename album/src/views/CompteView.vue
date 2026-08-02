<template>
    <div class="compte-page">
        <div class="compte-card">
            <h1>Mon compte</h1>

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
                <div v-if="utilisateur.type !== 'PA'" class="ligne">
                    <span class="label">Type</span>
                    <span class="valeur badge" :class="utilisateur.type">{{ utilisateur.type }}</span>
                </div>
                <div class="ligne">
                    <span class="label">Connexions</span>
                    <span class="valeur">{{ utilisateur.nombreConnexion }}</span>
                </div>
            </div>

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
                    <label>Nouveau mot de passe <span class="optionnel">(laisser vide pour ne pas changer)</span></label>
                    <div class="input-oeil">
                        <input v-model="form.motDePasse" :type="voirMdp ? 'text' : 'password'" placeholder="••••••••" />
                        <button type="button" class="btn-oeil" @click="voirMdp = !voirMdp">
                            <svg v-if="!voirMdp" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
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
            <div v-if="!modeEdition" class="btns-bas" style="margin-top: 12px;">
                <button class="btn-deconnexion" @click="seDeconnecter">Se déconnecter</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { connecter, deconnecter, rafraichir, utilisateur as utilisateurConnecte } from '../stores/auth.js'

const router     = useRouter()
const utilisateur = ref({})
const modeEdition = ref(false)
const erreur      = ref('')
const succes      = ref('')
const chargement  = ref(false)
const form        = ref({ nom: '', prenom: '', mail: '', motDePasse: '' })
const voirMdp     = ref(false)

onMounted(async () => {
    const data = await rafraichir()
    if (!data) return router.push('/login')
    utilisateur.value = data
})

function ouvrirEdition() {
    form.value = { nom: utilisateur.value.nom, prenom: utilisateur.value.prenom, mail: utilisateur.value.mail, motDePasse: '' }
    erreur.value = ''
    succes.value = ''
    modeEdition.value = true
}

function annuler() {
    modeEdition.value = false
    erreur.value = ''
}

async function sauvegarder() {
    erreur.value = ''
    succes.value = ''
    chargement.value = true
    try {
        const res  = await fetch(`/api/utilisateurs/${utilisateur.value.id}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nom: form.value.nom, prenom: form.value.prenom, mail: form.value.mail, motDePasse: form.value.motDePasse || undefined })
        })
        const data = await res.json()
        if (!res.ok) {
            erreur.value = data.erreur || 'Erreur lors de la modification'
        } else {
            utilisateur.value = { ...utilisateur.value, nom: form.value.nom, prenom: form.value.prenom, mail: form.value.mail }
            connecter({ ...utilisateurConnecte.value, nom: form.value.nom, prenom: form.value.prenom, mail: form.value.mail })
            succes.value = 'Modifications enregistrées'
            setTimeout(() => { modeEdition.value = false; succes.value = '' }, 1200)
        }
    } catch {
        erreur.value = 'Erreur de connexion au serveur'
    } finally {
        chargement.value = false
    }
}

function seDeconnecter() {
    deconnecter()
    router.push('/login')
}

async function supprimerCompte() {
    if (!confirm('Supprimer définitivement votre compte ?')) return
    await fetch(`/api/utilisateurs/${utilisateur.value.id}`, { method: 'DELETE' })
    deconnecter()
    router.push('/login')
}
</script>

<style scoped>
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
.btn-deconnexion {
    width: 100%;
    padding: 12px;
    background: #718096;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-deconnexion:hover { background: #4a5568; }
.erreur { color: #e53e3e; font-size: 0.9rem; text-align: center; }
.succes { color: #38a169; font-size: 0.9rem; text-align: center; }
</style>
