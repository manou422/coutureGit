// ===================================================================
//  menu-mobile.cy.js — le menu amovible sur téléphone
// ===================================================================
//
//  Sur petit écran, le menu ne tient plus une colonne en permanence :
//  il est rangé hors cadre et un bouton le fait glisser. Ces tests
//  vérifient qu'il s'ouvre, qu'il se referme par les trois chemins
//  prévus, et qu'il redevient permanent sur grand écran.
//
//  Comme le menu n'existe que sur les pages protégées, tout ce fichier
//  demande d'être connecté : sans identifiants dans le .env, il se
//  saute entièrement.

// Un téléphone courant, sous le seuil de 620 px des règles @media.
const TELEPHONE = [390, 844]

describe('Menu sur téléphone', () => {

    beforeEach(function () {
        cy.identifiantsUtilisables().then((ok) => { if (!ok) this.skip() })
        cy.viewport(...TELEPHONE)
        cy.connexion()
        cy.visit('/')
    })

    it('cache le menu au chargement et montre le bouton', () => {
        // `visibility: hidden` en plus du décalage hors cadre : sans elle,
        // le menu resterait atteignable au clavier et lu à voix haute.
        cy.get('nav').should('not.be.visible')
        cy.get('.burger')
            .should('be.visible')
            .and('have.attr', 'aria-expanded', 'false')
    })

    it('amène le menu au clic sur le bouton', () => {
        cy.get('.burger').click()
        cy.get('nav').should('be.visible')
        cy.get('.burger').should('have.attr', 'aria-expanded', 'true')
        // Le voile n'apparaît qu'avec le menu : il sert à le refermer.
        cy.get('.voile').should('exist')
    })

    it('le referme au toucher du voile', () => {
        cy.get('.burger').click()
        cy.get('.voile').click()
        cy.get('nav').should('not.be.visible')
        cy.get('.voile').should('not.exist')
    })

    it('le referme avec la touche Échap', () => {
        cy.get('.burger').click()
        cy.get('body').type('{esc}')
        cy.get('nav').should('not.be.visible')
    })

    it('le referme quand on suit un lien', () => {
        // Le laisser ouvert masquerait l'écran qu'on vient de demander.
        cy.get('.burger').click()
        cy.get('nav').contains('Compte').click()
        cy.location('pathname').should('eq', '/compte')
        cy.get('nav').should('not.be.visible')
    })

    it('ne laisse pas le bouton retour sous le bouton du menu', () => {
        // Les deux sont fixés en haut à gauche : ils doivent se suivre,
        // pas se superposer. `/compte` est une page qui porte les deux.
        cy.visit('/compte')
        cy.get('.burger').then(($b) => {
            const menu = $b[0].getBoundingClientRect()
            cy.get('.btn-retour').then(($r) => {
                expect($r[0].getBoundingClientRect().left).to.be.greaterThan(menu.right)
            })
        })
    })
})


describe('Menu sur grand écran', () => {

    beforeEach(function () {
        cy.identifiantsUtilisables().then((ok) => { if (!ok) this.skip() })
        cy.viewport(1280, 800)
        cy.connexion()
        cy.visit('/')
    })

    it('affiche le menu en permanence, sans bouton d\'ouverture', () => {
        cy.get('nav').should('be.visible')
        cy.get('.burger').should('not.be.visible')
        cy.get('.voile').should('not.exist')
    })

    it('décale le contenu de la largeur du menu', () => {
        // Les deux valeurs sont écrites séparément — .avec-nav dans
        // App.vue, la largeur dans NavBar.vue — et doivent concorder,
        // sans quoi le menu couvrirait le début de la page.
        cy.get('nav').then(($nav) => {
            const largeur = $nav[0].getBoundingClientRect().width
            cy.get('.avec-nav').should(($page) => {
                expect(parseFloat(getComputedStyle($page[0]).paddingLeft)).to.eq(largeur)
            })
        })
    })
})
