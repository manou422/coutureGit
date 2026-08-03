<template>
    <div class="page">
        <div class="carte">
            <h1>Mot de passe oublié</h1>

            <p v-if="!disponible && configChargee" class="indispo">
                L'envoi d'emails n'est pas configuré sur ce site.
                Contactez Manuela pour faire réinitialiser votre mot de passe.
            </p>

            <template v-else>
                <p class="intro">
                    Saisissez votre adresse email : vous recevrez un lien pour choisir
                    un nouveau mot de passe.
                </p>

                <form @submit.prevent="envoyer">
                    <div class="champ">
                        <label>Email</label>
                        <input v-model="mail" type="email" placeholder="votre@email.com" required />
                    </div>

                    <p v-if="erreur" class="erreur">{{ erreur }}</p>
                    <p v-if="envoye" class="succes">
                        Si un compte existe avec cette adresse, un email vient d'être envoyé.
                        Pensez à regarder vos courriers indésirables.
                    </p>

                    <button type="submit" :disabled="chargement || envoye">
                        {{ chargement ? 'Envoi...' : 'Recevoir le lien' }}
                    </button>
                </form>
            </template>

            <p class="lien"><RouterLink to="/login">Retour à la connexion</RouterLink></p>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const mail         = ref('')
const erreur       = ref('')
const envoye       = ref(false)
const chargement   = ref(false)
const disponible   = ref(true)
const configChargee = ref(false)

onMounted(async () => {
    try {
        const res = await fetch('/api/mot-de-passe-oublie/config')
        disponible.value = (await res.json()).disponible
    } catch {
        disponible.value = false
    } finally {
        configChargee.value = true
    }
})

async function envoyer() {
    erreur.value = ''
    chargement.value = true
    try {
        const res  = await fetch('/api/mot-de-passe-oublie', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ mail: mail.value })
        })
        const data = await res.json()
        if (!res.ok) erreur.value = data.erreur || 'Erreur lors de la demande'
        else envoye.value = true
    } catch {
        erreur.value = 'Erreur de connexion au serveur'
    } finally {
        chargement.value = false
    }
}
</script>

<style scoped>
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
    margin-bottom: 16px;
    font-size: 1.6rem;
}
.intro {
    color: #666;
    font-size: 0.9rem;
    text-align: center;
    margin-bottom: 24px;
    line-height: 1.5;
}
.indispo {
    color: #7a5200;
    background: #fff6e0;
    border: 1px solid #ffe0a3;
    border-radius: 8px;
    padding: 14px;
    font-size: 0.9rem;
    line-height: 1.5;
    margin-bottom: 20px;
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
    transition: border-color 0.2s;
}
input:focus { border-color: #3355cc; }
button {
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
button:hover:not(:disabled) { background: #2244bb; }
button:disabled { background: #aaa; cursor: default; }
.erreur { color: #e53e3e; font-size: 0.9rem; text-align: center; }
.succes { color: #38a169; font-size: 0.9rem; text-align: center; line-height: 1.5; }
.lien { text-align: center; margin-top: 20px; font-size: 0.9rem; }
.lien a { color: #3355cc; font-weight: 600; text-decoration: none; }
</style>
