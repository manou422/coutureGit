// ===================================================================
//  stores/supports.js — les supports d'où viennent les modèles
// ===================================================================
//
//  Un support est un livre, un magazine ou un site, et porte le nombre
//  de projets qui en ont été tirés. Ce nombre est saisi à la main : rien
//  ne relie une création à son support en base, et un même ouvrage peut
//  avoir servi bien avant que l'album n'existe.
//
//  Troisième store, bâti comme photos.js : une liste partagée, et les
//  opérations qui la modifient. Chacune relève le message du serveur en
//  cas de refus, que la page attrape et affiche.
import { ref } from 'vue'
import { api } from './auth.js'

export const supports = ref([])  // la liste, partagée par la page

// Les trois types admis, dans l'ordre où le formulaire les propose. Le
// serveur tient la même liste et refuse tout autre valeur : celle-ci ne
// sert qu'à remplir le menu déroulant et à nommer les types à l'écran.
export const TYPES = [
    { valeur: 'livre',    libelle: 'Livre' },
    { valeur: 'magazine', libelle: 'Magazine' },
    { valeur: 'site',     libelle: 'Site internet' }
]

export function libelleDuType(valeur) {
    return TYPES.find(t => t.valeur === valeur)?.libelle || valeur
}


// Relève le message d'erreur du serveur, ou en fabrique un qui dise au
// moins quelque chose. Le cas « route inconnue » est explicité : c'est
// ce qu'on obtient quand le site est à jour mais pas le serveur.
async function erreurDe(res, parDefaut) {
    const data = await res.json().catch(() => ({}))
    return data.erreur
        || `${parDefaut} (erreur ${res.status}). Le serveur n'est peut-être pas à jour.`
}


export async function chargerSupports() {
    const res = await api('/api/supports')
    if (res.ok) supports.value = await res.json()
}


export async function ajouterSupport(support) {
    const res = await api('/api/supports', {
        method: 'POST',
        body:   JSON.stringify(support)
    })
    if (!res.ok) throw new Error(await erreurDe(res, 'Ajout impossible'))
    supports.value.push(await res.json())
    trier()
}


export async function modifierSupport(id, support) {
    const res = await api(`/api/supports/${id}`, {
        method: 'PUT',
        body:   JSON.stringify(support)
    })
    if (!res.ok) throw new Error(await erreurDe(res, 'Modification impossible'))

    // On remplace la ligne par celle que renvoie le serveur, et non par
    // ce qu'on lui a envoyé : c'est lui qui nettoie le nombre et décide
    // si le lien est retenu.
    const misAJour = await res.json()
    const i = supports.value.findIndex(s => s.id === id)
    if (i !== -1) supports.value[i] = misAJour
    trier()
}


export async function supprimerSupport(id) {
    const res = await api(`/api/supports/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await erreurDe(res, 'Suppression impossible'))
    const i = supports.value.findIndex(s => s.id === id)
    if (i !== -1) supports.value.splice(i, 1)
}


// Le serveur rend la liste du plus utilisé au moins utilisé ; on garde
// cet ordre après un ajout ou une modification, plutôt que de tout
// recharger pour un seul nombre qui change.
function trier() {
    supports.value.sort((a, b) =>
        b.nombre - a.nombre || a.nom.localeCompare(b.nom, 'fr'))
}
