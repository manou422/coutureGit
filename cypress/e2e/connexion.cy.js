// ===================================================================
//  connexion.cy.js — l'écran de connexion et la garde de navigation
// ===================================================================
//
//  Ces tests-ci ne demandent aucun identifiant valable : ils vérifient
//  ce qui se passe AVANT d'être connecté. Ils tournent donc sur
//  n'importe quelle base, y compris vide.

describe('Connexion', () => {

    it('affiche le formulaire', () => {
        cy.visit('/login')
        cy.contains('h1', 'Connexion').should('be.visible')
        cy.get('input[type="email"]').should('be.visible')
        cy.get('input[type="password"]').should('be.visible')
        cy.contains('button', 'Se connecter').should('be.enabled')
    })

    it('propose de créer un compte et de récupérer un mot de passe', () => {
        cy.visit('/login')
        cy.contains('a', 'Créer un compte').should('have.attr', 'href', '/inscription')
        cy.contains('a', 'Mot de passe oublié ?').should('have.attr', 'href', '/mot-de-passe-oublie')
    })

    it('masque le mot de passe, et le montre au clic sur l\'œil', () => {
        cy.visit('/login')
        cy.get('input[type="password"]').type('peu importe', { log: false })
        cy.get('.btn-oeil').click()
        // Le champ n'a pas changé de place : c'est son `type` qui bascule.
        cy.get('.input-oeil input').should('have.attr', 'type', 'text')
        cy.get('.btn-oeil').click()
        cy.get('.input-oeil input').should('have.attr', 'type', 'password')
    })

    it('refuse des identifiants inconnus, sans dire lequel est faux', () => {
        cy.connexionParLeFormulaire('personne@exemple.fr', 'mauvais-mot-de-passe')
        // Le serveur répond volontairement la même chose pour un email
        // inconnu et pour un mot de passe faux : sinon la page dirait
        // quelles adresses sont inscrites.
        cy.get('.erreur').should('contain', 'Email ou mot de passe incorrect')
        cy.location('pathname').should('eq', '/login')
    })

    it('renvoie vers /login qui demande une page protégée', () => {
        cy.visit('/galerie')
        cy.location('pathname').should('eq', '/login')
    })
})


// ------------------------------------------------------------------
//  Ce bloc-ci a besoin d'un compte réel. Si les identifiants du .env
//  sont absents ou refusés, il se saute au lieu d'échouer — un test
//  rouge doit signaler une régression, pas une configuration périmée.
// ------------------------------------------------------------------
describe('Connexion réussie', () => {

    beforeEach(function () {
        cy.identifiantsUtilisables().then((ok) => { if (!ok) this.skip() })
    })

    it('mène à l\'accueil et affiche le menu', () => {
        // Sans arguments : la commande prend les identifiants du .env.
        cy.connexionParLeFormulaire()
        cy.location('pathname').should('eq', '/')
        cy.get('nav').should('be.visible')
    })

    it('range le jeton, et le retire à la déconnexion', () => {
        cy.connexion()
        cy.visit('/')
        cy.window().its('localStorage.token').should('be.a', 'string')

        cy.contains('button', 'Déconnexion').click()
        cy.location('pathname').should('eq', '/login')
        cy.window().its('localStorage.token').should('not.exist')
    })
})
