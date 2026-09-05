// ===================================================================
//  cypress/support/commands.js — les commandes maison
// ===================================================================
//
//  `Cypress.Commands.add` ajoute une méthode à `cy`, utilisable ensuite
//  dans n'importe quel test comme les commandes fournies.

// Connexion par l'API plutôt que par le formulaire.
//
// Passer par l'écran de connexion à chaque test serait lent, et surtout
// ferait échouer un test sur la galerie parce que le formulaire a
// changé — un test doit échouer pour ce qu'il vérifie, pas pour autre
// chose. On appelle donc /api/login directement et on range le résultat
// là où le site l'attend, exactement comme le fait `connecter()` dans
// album/src/stores/auth.js.
Cypress.Commands.add('connexion', (mail, motDePasse) => {
    const identifiant = mail       ?? Cypress.env('mail')
    const secret      = motDePasse ?? Cypress.env('motDePasse')

    cy.request({
        method: 'POST',
        url:    '/api/login',
        body:   { email: identifiant, motDePasse: secret }
    }).then(({ body }) => {
        // `cy.visit` doit précéder l'écriture : avant la première visite,
        // le localStorage appartient encore à une page vierge, et ce qu'on
        // y écrirait serait perdu.
        cy.visit('/login')
        cy.window().then((fenetre) => {
            fenetre.localStorage.setItem('connecte', 'true')
            fenetre.localStorage.setItem('utilisateur', JSON.stringify(body.utilisateur))
            fenetre.localStorage.setItem('token', body.token)
        })
    })
})


// Connexion par le formulaire, celle-là. Réservée aux tests qui
// vérifient l'écran de connexion lui-même.
Cypress.Commands.add('connexionParLeFormulaire', (mail, motDePasse) => {
    cy.visit('/login')
    cy.get('input[type="email"]').type(mail)
    // `{ log: false }` : sans cela le mot de passe s'afficherait en clair
    // dans le journal des tests, et donc dans les captures d'échec.
    cy.get('input[type="password"]').type(motDePasse, { log: false })
    cy.contains('button', 'Se connecter').click()
})


// Les tests qui demandent un compte réel s'appuient sur celle-ci :
// elle répond si les identifiants du .env permettent vraiment d'entrer.
//
// Vérifier leur seule présence ne suffirait pas. ADMIN_PASSWORD ne sert
// qu'à créer le compte au premier démarrage sur une base vide ; dès
// qu'on change son mot de passe depuis « Compte », la valeur du .env
// devient périmée sans que rien ne le signale. Les tests deviendraient
// alors rouges pour une raison étrangère au code.
//
// La réponse est retenue après le premier appel : un aller-retour par
// test serait inutile, les identifiants ne changent pas en cours de route.
let identifiantsValables = null

Cypress.Commands.add('identifiantsUtilisables', () => {
    if (!Cypress.env('mail') || !Cypress.env('motDePasse')) {
        return cy.wrap(false, { log: false })
    }
    if (identifiantsValables !== null) {
        return cy.wrap(identifiantsValables, { log: false })
    }

    return cy.request({
        method: 'POST',
        url:    '/api/login',
        body:   { email: Cypress.env('mail'), motDePasse: Cypress.env('motDePasse') },
        failOnStatusCode: false   // un 401 est une réponse, pas un incident
    }).then((res) => {
        identifiantsValables = res.status === 200
        if (!identifiantsValables) {
            cy.log('ADMIN_EMAIL / ADMIN_PASSWORD du .env sont refusés par l\'API ' +
                   `(HTTP ${res.status}) — les tests qui demandent un compte sont sautés.`)
        }
        return identifiantsValables
    })
})
