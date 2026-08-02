import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { assurerSynchro } from './stores/auth.js'
import HomeView from './views/HomeView.vue'
import GalerieView from './views/GalerieView.vue'
import DescriptionView from './views/DescriptionView.vue'
import AjouterView from './views/AjouterView.vue'
import ModifierView from './views/ModifierView.vue'
import LoginView from './views/LoginView.vue'
import InscriptionView from './views/InscriptionView.vue'
import CompteView from './views/CompteView.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/login',           component: LoginView },
        { path: '/inscription',     component: InscriptionView },
        { path: '/',                component: HomeView,        meta: { requiresAuth: true } },
        { path: '/galerie',         component: GalerieView,     meta: { requiresAuth: true } },
        { path: '/description/:id', component: DescriptionView, meta: { requiresAuth: true } },
        { path: '/ajouter',         component: AjouterView,     meta: { requiresAuth: true, adminOnly: true } },
        { path: '/modifier/:id',    component: ModifierView,    meta: { requiresAuth: true, adminOnly: true } },
        { path: '/compte',          component: CompteView,      meta: { requiresAuth: true } },
    ]
})

router.beforeEach(async (to) => {
    if (!to.meta.requiresAuth) return

    // Resynchronise le profil (donc le rôle) depuis le serveur au premier
    // chargement : le localStorage seul peut être périmé.
    const utilisateur = await assurerSynchro()
    if (!utilisateur) return '/login'

    if (to.meta.adminOnly && utilisateur.type !== 'admin') return '/'
})

createApp(App).use(router).mount('#app')
