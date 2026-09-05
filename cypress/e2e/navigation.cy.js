// ===================================================================
//  navigation.cy.js — le menu et le passage d'un écran à l'autre
// ===================================================================
//
//  Tout ce fichier demande d'être connecté : les pages visées sont
//  protégées par la garde du routeur. Sans identifiants dans le .env,
//  il se saute entièrement.

describe('Menu et navigation', () => {

    beforeEach(function () {
        cy.identifiantsUtilisables().then((ok) => { if (!ok) this.skip() })
        cy.connexion()
        cy.visit('/')
    })

    it('montre le logo en tête du menu', () => {
        cy.get('nav .logo')
            .should('be.visible')
            .and('have.attr', 'src', '/photos/logo-manucrea.png')
        // Une image porteuse de sens doit avoir un texte de remplacement :
        // c'est ce que lit une personne qui n'y voit pas.
        cy.get('nav .logo').should('have.attr', 'alt').and('not.be.empty')
    })

    it('charge réellement le logo, sans erreur 404', () => {
        // `naturalWidth` vaut 0 quand le navigateur n'a pas pu charger
        // l'image : l'attribut src peut être juste et le fichier absent.
        cy.get('nav .logo').should(($img) => {
            expect($img[0].naturalWidth).to.be.greaterThan(0)
        })
    })

    it('mène à la galerie et souligne le lien courant', () => {
        cy.get('nav').contains('Galerie').click()
        cy.location('pathname').should('eq', '/galerie')
        cy.get('.lien-galerie').should('have.class', 'router-link-exact-active')
    })

    it('déplie et replie la liste des catégories', () => {
        cy.get('nav').contains('Galerie').click()
        cy.get('.sous-menu').should('be.visible')
        cy.get('.chevron').click()
        cy.get('.sous-menu').should('not.exist')
    })

    it('donne accès au compte', () => {
        cy.get('nav').contains('Compte').click()
        cy.location('pathname').should('eq', '/compte')
    })
})


describe('Page d\'accueil', () => {

    beforeEach(function () {
        cy.identifiantsUtilisables().then((ok) => { if (!ok) this.skip() })
        cy.connexion()
        cy.visit('/')
    })

    it('affiche l\'illustration des créations', () => {
        cy.get('.home img')
            .should('be.visible')
            .and('have.attr', 'src', '/photos/accueil-creations.svg')
    })

    it('n\'enveloppe pas l\'illustration dans un lien', () => {
        // Choix délibéré : le menu mène déjà à la galerie, deux chemins
        // vers la même page se marcheraient dessus.
        cy.get('.home img').parents('a').should('not.exist')
    })
})
