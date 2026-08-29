// ===================================================================
//  main.js — le démarrage du site (« le front »)
// ===================================================================
//
//  Ce fichier fait trois choses :
//    1. il déclare le plan du site : quelle adresse affiche quel écran ;
//    2. il pose les règles d'accès (page réservée aux connectés, ou à
//       l'administratrice) ;
//    3. il démarre l'application Vue.
//
//  Chaque écran est un fichier de views/ ; chaque fichier .vue contient
//  son affichage (template), son code (script) et son style.
//
//  Vue d'ensemble du projet : voir README.md à la racine.
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { assurerSynchro } from './stores/auth.js'
import HomeView from './views/HomeView.vue'
import GalerieView from './views/GalerieView.vue'
import CategoriesView from './views/CategoriesView.vue'
import StatistiquesView from './views/StatistiquesView.vue'
import DescriptionView from './views/DescriptionView.vue'
import AjouterView from './views/AjouterView.vue'
import ModifierView from './views/ModifierView.vue'
import LoginView from './views/LoginView.vue'
import InscriptionView from './views/InscriptionView.vue'
import CompteView from './views/CompteView.vue'
import MotDePasseOublieView from './views/MotDePasseOublieView.vue'
import ReinitialiserView from './views/ReinitialiserView.vue'


// Le routeur : la table de correspondance entre adresses et écrans.
//
// `createWebHistory` donne de vraies adresses (/galerie et non /#/galerie).
// C'est ce qui oblige le serveur à renvoyer index.html sur toute adresse
// inconnue — voir la dernière route de server.js.
//
// `meta` est un fourre-tout libre attaché à la route ; il est relu juste
// en dessous, dans beforeEach :
//   requiresAuth : il faut être connecté
//   adminOnly    : réservé à l'administratrice
// Les quatre premières routes en sont dépourvues : ce sont les seules
// pages accessibles sans compte.
const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/login',           component: LoginView },
        { path: '/inscription',        component: InscriptionView },
        { path: '/mot-de-passe-oublie', component: MotDePasseOublieView },
        { path: '/reinitialiser/:token', component: ReinitialiserView },
        { path: '/',                component: HomeView,        meta: { requiresAuth: true } },
        { path: '/galerie',         component: GalerieView,     meta: { requiresAuth: true } },
        { path: '/categories',      component: CategoriesView,  meta: { requiresAuth: true } },
        { path: '/statistiques',    component: StatistiquesView, meta: { requiresAuth: true, adminOnly: true } },
        { path: '/description/:id', component: DescriptionView, meta: { requiresAuth: true } },
        { path: '/ajouter',         component: AjouterView,     meta: { requiresAuth: true, adminOnly: true } },
        { path: '/modifier/:id',    component: ModifierView,    meta: { requiresAuth: true, adminOnly: true } },
        { path: '/compte',          component: CompteView,      meta: { requiresAuth: true } },
    ]
})


// « Garde de navigation » : cette fonction est appelée avant CHAQUE
// changement de page. Elle peut laisser passer (ne rien renvoyer) ou
// détourner vers une autre adresse (renvoyer un chemin).
//
// C'est un confort d'affichage, pas une sécurité : c'est le serveur qui
// refuse pour de bon (`authentifier` / `adminSeulement`). Ici, on évite
// simplement d'afficher une page vide à qui n'y a pas droit.
router.beforeEach(async (to) => {
    if (!to.meta.requiresAuth) return  // page publique : rien à vérifier

    // Resynchronise le profil (donc le rôle) depuis le serveur au premier
    // chargement : le localStorage seul peut être périmé.
    const utilisateur = await assurerSynchro()
    if (!utilisateur) return '/login'

    // Connecté mais pas administratrice : on renvoie à l'accueil.
    if (to.meta.adminOnly && utilisateur.type !== 'admin') return '/'
})


// Crée l'application à partir de App.vue, lui branche le routeur, et
// l'installe dans le <div id="app"> de index.html.
createApp(App).use(router).mount('#app')
