// ===================================================================
//  vite.config.js — réglages de Vite, l'outil qui fait tourner le site
// ===================================================================
//
//  Vite fait deux choses : en développement il sert le site avec
//  rechargement instantané, et en production (`npm run build`) il compile
//  tout dans album/dist/, que le serveur Express distribue ensuite.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    // Le plugin qui apprend à Vite à lire les fichiers .vue.
    plugins: [vue()],
    // Réglages du serveur de développement uniquement.
    //
    // `proxy` est le point important : pendant le développement, le site est
    // sur le port 5173 et l'API sur le 3000. Toute adresse commençant par
    // /api est donc réexpédiée vers le port 3000. C'est ce qui permet
    // d'écrire fetch('/api/photos') dans le code, sans jamais nommer de port
    // — et de garder exactement le même code en production, où les deux sont
    // servis ensemble.
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
})
