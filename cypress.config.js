// ===================================================================
//  cypress.config.js — réglages des tests de bout en bout
// ===================================================================
//
//  Cypress pilote un vrai navigateur sur le site réellement démarré :
//  il clique, remplit les champs et lit ce qui s'affiche, comme le
//  ferait une personne. Il ne remplace donc pas la lecture du code —
//  il vérifie que l'ensemble tient debout une fois assemblé.
//
//  Les deux moitiés du projet doivent tourner avant de lancer les
//  tests, c'est-à-dire `npm run dev` à la racine : le site sur le port
//  5173 et l'API sur le 3000. Sans l'API, tout échouerait sur des
//  erreurs réseau, dont les symptômes sont trompeurs.
//
//  Usage :  npm run test:e2e     (sans fenêtre, pour un enchaînement)
//           npm run cypress      (avec fenêtre, pour écrire un test)

const { defineConfig } = require('cypress')
const fs   = require('node:fs')
const path = require('node:path')

// Les identifiants de test sont lus dans le .env du projet plutôt que
// recopiés ici : un mot de passe écrit dans un fichier suivi par git
// finit toujours par être publié. Le .env, lui, est dans .gitignore.
//
// Ce petit lecteur suffit : le fichier ne contient que des lignes
// `CLE=valeur`, sans guillemets ni continuation.
function lireEnv() {
    const fichier = path.join(__dirname, '.env')
    if (!fs.existsSync(fichier)) return {}

    const valeurs = {}
    for (const ligne of fs.readFileSync(fichier, 'utf8').split('\n')) {
        const nette = ligne.trim()
        if (!nette || nette.startsWith('#')) continue
        const separateur = nette.indexOf('=')
        if (separateur === -1) continue
        valeurs[nette.slice(0, separateur).trim()] = nette.slice(separateur + 1).trim()
    }
    return valeurs
}

const env = lireEnv()

module.exports = defineConfig({
    e2e: {
        // Toutes les adresses des tests sont relatives à celle-ci :
        // `cy.visit('/galerie')` suffit.
        baseUrl: 'http://localhost:5173',

        // Où trouver les tests, et le fichier chargé avant chacun d'eux.
        specPattern:  'cypress/e2e/**/*.cy.js',
        supportFile:  'cypress/support/e2e.js',
        fixturesFolder: 'cypress/fixtures',

        // Les vidéos alourdissent le dossier sans rien apprendre de plus
        // que les captures, prises automatiquement en cas d'échec.
        video: false,
        screenshotOnRunFailure: true,

        // Taille de fenêtre par défaut. Assez large pour que le menu
        // fixe de 190 px ne recouvre pas le contenu testé.
        viewportWidth:  1280,
        viewportHeight: 800,

        // Identifiants mis à disposition des tests.
        //
        // Depuis Cypress 16, `env` est réservé aux valeurs SENSIBLES :
        // elles restent côté Node et ne se lisent que par `cy.env([...])`,
        // sans jamais être recopiées dans le navigateur — donc sans
        // apparaître dans les captures d'écran ni dans le journal. Les
        // valeurs anodines se déclarent, elles, dans `expose`.
        //
        // Absents du .env, ces champs valent `undefined` : les tests qui
        // en dépendent se sautent d'eux-mêmes plutôt que d'échouer.
        env: {
            mail:       env.ADMIN_EMAIL,
            motDePasse: env.ADMIN_PASSWORD,
            codeInvitation: env.INVITATION_CODE
        }
    }
})
