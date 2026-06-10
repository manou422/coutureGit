import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
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

router.beforeEach((to) => {
    if (to.meta.requiresAuth && !localStorage.getItem('connecte')) {
        return '/login'
    }
    if (to.meta.adminOnly) {
        const utilisateur = JSON.parse(localStorage.getItem('utilisateur') || '{}')
        if (utilisateur.type !== 'admin') return '/'
    }
})

const vuetify = createVuetify({ components, directives })

createApp(App).use(router).use(vuetify).mount('#app')
