// ===================================================================
//  cypress/support/e2e.js — chargé avant chaque fichier de test
// ===================================================================
//
//  C'est l'endroit prévu pour ce qui doit valoir partout : les
//  commandes maison, et les réglages communs à tous les tests.

import './commands.js'

// Le site range son jeton de session dans le localStorage. Cypress vide
// les cookies entre deux tests, mais pas le localStorage : sans ce
// nettoyage, un test partirait connecté parce que le précédent l'était,
// et passerait pour de mauvaises raisons.
beforeEach(() => {
    cy.clearLocalStorage()
})
