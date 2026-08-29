<!-- ===================================================================
      StatistiquesView.vue — la page « Fréquentation »
     ===================================================================

      Réservée à l'administratrice. Elle montre qui vient, et quand :
      trois chiffres en haut, puis les visites jour par jour, puis un
      récapitulatif par membre.

      Le comptage est fait à la journée : quelqu'un qui se connecte dix
      fois dans la même journée compte pour une visite. C'est bien
      « combien de personnes sont venues », pas « combien de connexions ». -->
<template>
    <div class="page">
        <h1>Fréquentation</h1>

        <!-- Les trois tuiles de résumé, affichées une fois les chiffres reçus. -->
        <div v-if="stats" class="resume">
            <div class="tuile">
                <span class="chiffre">{{ stats.nombreMembres }}</span>
                <span class="libelle">membre{{ stats.nombreMembres > 1 ? 's' : '' }} inscrit{{ stats.nombreMembres > 1 ? 's' : '' }}</span>
            </div>
            <div class="tuile">
                <span class="chiffre">{{ visiteursDistincts }}</span>
                <span class="libelle">{{ visiteursDistincts > 1 ? 'se sont' : "s'est" }} déjà connecté{{ visiteursDistincts > 1 ? 's' : '' }}</span>
            </div>
            <div class="tuile">
                <span class="chiffre">{{ stats.parJour.length }}</span>
                <span class="libelle">jour{{ stats.parJour.length > 1 ? 's' : '' }} avec au moins une visite</span>
            </div>
        </div>

        <template v-if="stats">
            <h2>Visites par jour</h2>
            <p class="note">Une personne n'est comptée qu'une fois par jour, même si elle se connecte plusieurs fois.</p>

            <table v-if="stats.parJour.length">
                <thead>
                    <tr><th>Date</th><th class="nb">Personnes</th><th>Qui</th></tr>
                </thead>
                <tbody>
                    <!-- Une ligne par jour ayant eu au moins une visite, du plus récent au plus ancien. -->
                    <tr v-for="j in stats.parJour" :key="j.jour">
                        <td class="date">{{ formaterDate(j.jour) }}</td>
                        <td class="nb"><span class="pastille">{{ j.personnes }}</span></td>
                        <td class="qui">{{ j.qui }}</td>
                    </tr>
                </tbody>
            </table>
            <p v-else class="etat">Aucune connexion enregistrée pour l'instant.</p>

            <h2>Par membre</h2>
            <table>
                <thead>
                    <tr>
                        <th>Membre</th>
                        <th class="nb">Jours de visite</th>
                        <th>Dernière visite</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Une ligne par membre inscrit, même ceux qui ne sont jamais venus. -->
                    <tr v-for="m in stats.membres" :key="m.id">
                        <td>
                            {{ m.prenom }} {{ m.nom }}
                            <span v-if="m.type === 'admin'" class="badge">admin</span>
                        </td>
                        <td class="nb"><span class="pastille">{{ m.joursDeVisite }}</span></td>
                        <td class="date">
                            {{ m.derniereVisite ? formaterDate(m.derniereVisite) : '—' }}
                        </td>
                    </tr>
                </tbody>
            </table>
            <p class="note">
                Le journal a commencé le jour où cette page a été installée : les
                connexions antérieures n'y figurent pas.
            </p>
        </template>

        <p v-else-if="erreur" class="etat">{{ erreur }}</p>
        <p v-else class="etat">Chargement...</p>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../stores/auth.js'

const stats  = ref(null)
const erreur = ref('')

// Combien de membres se sont déjà connectés au moins une fois — à
// distinguer du nombre d'inscrits, qui compte aussi ceux qui ne sont
// jamais venus.
const visiteursDistincts = computed(() =>
    stats.value ? stats.value.membres.filter(m => m.joursDeVisite > 0).length : 0
)

// Un seul appel suffit : le serveur renvoie les trois blocs ensemble.
// Un refus signifie que le compte n'est pas administrateur.
onMounted(async () => {
    try {
        const res = await api('/api/statistiques')
        if (!res.ok) { erreur.value = 'Accès refusé'; return }
        stats.value = await res.json()
    } catch {
        erreur.value = 'Erreur de connexion au serveur'
    }
})

// La date arrive en AAAA-MM-JJ. On la découpe plutôt que de passer par
// `new Date()`, qui interpréterait la chaîne en UTC et pourrait afficher
// la veille selon le fuseau.
function formaterDate(iso) {
    const [a, m, j] = iso.split('-').map(Number)
    return new Date(a, m - 1, j).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
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
    max-width: 860px;
    margin: 0 auto;
}
h1 { text-align: center; color: #333; margin-bottom: 28px; }
h2 {
    font-size: 1.15rem;
    color: #333;
    margin: 36px 0 6px;
}
.note { font-size: 0.85rem; color: #888; margin-bottom: 14px; line-height: 1.5; }

.resume {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
}
.tuile {
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.09);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    text-align: center;
}
.chiffre { font-size: 2rem; font-weight: 700; color: #3355cc; line-height: 1; }
.libelle { font-size: 0.85rem; color: #666; }

table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,0.09);
}
th, td {
    padding: 11px 14px;
    text-align: left;
    font-size: 0.9rem;
    border-bottom: 1px solid #f0f0f0;
}
th {
    background: #f8f9ff;
    color: #555;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
tbody tr:last-child td { border-bottom: none; }
td.date { color: #333; }
td.qui { color: #777; font-size: 0.85rem; }
.nb { text-align: center; width: 130px; }
.pastille {
    display: inline-block;
    min-width: 26px;
    padding: 2px 9px;
    background: #e8f0ff;
    color: #3355cc;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.85rem;
}
.badge {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 8px;
    background: #e8f0ff;
    color: #3355cc;
    border-radius: 10px;
    font-size: 0.72rem;
    font-weight: 600;
}
.etat { text-align: center; color: #888; margin-top: 40px; }

@media (max-width: 620px) {
    td.qui, th:last-child { display: none; }
}
</style>
