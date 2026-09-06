// ===================================================================
//  creations.cy.js — la règle « une création, un seul titre »
// ===================================================================
//
//  Ces tests parlent à l'API plutôt qu'à l'écran : la règle est posée
//  côté serveur, et c'est là qu'elle doit être vérifiée. Cacher le
//  bouton d'ajout ne protégerait rien.
//
//  Ils n'écrivent rien dans la base : ils se contentent de se faire
//  refuser un ajout. Le filet de sécurité en fin de fichier efface tout
//  de même ce qu'un ajout aurait créé si la règle venait à sauter, sans
//  quoi un test en échec laisserait une trace derrière lui.
//
//  L'ajout étant réservé à l'administratrice, ils se sautent aussi bien
//  sans identifiants dans le .env que si le compte n'est pas admin.

const IMAGE = 'data:image/png;base64,iVBORw0KGgo='

describe('Créations en double', () => {

    // Le jeton, le rôle, et la liste des créations telle qu'elle était
    // avant l'épreuve — c'est elle qui permettra de ne supprimer, à la
    // fin, que ce que le test aurait lui-même ajouté.
    beforeEach(function () {
        cy.identifiantsUtilisables().then((utilisables) => {
            if (!utilisables) return this.skip()

            return cy.env(['mail', 'motDePasse'], { log: false })
                .then(({ mail, motDePasse }) => cy.request({
                    method: 'POST', url: '/api/login',
                    body: { email: mail, motDePasse }
                }))
                .then(({ body }) => {
                    if (body.utilisateur.type !== 'admin') {
                        cy.log('Le compte du .env n\'est pas administrateur — ' +
                               'les tests d\'ajout sont sautés.')
                        return this.skip()
                    }
                    this.jeton = body.token
                    return cy.request({
                        url: '/api/photos',
                        headers: { Authorization: `Bearer ${this.jeton}` }
                    })
                })
                .then((res) => {
                    if (res) this.idsAvant = new Set(res.body.map(c => c.id))
                })
        })
    })

    // Petit raccourci : un ajout qui a le droit d'échouer, puisque c'est
    // justement ce qu'on attend de lui.
    function tenterAjout(jeton, titre) {
        return cy.request({
            method: 'POST',
            url:    '/api/photos',
            headers: { Authorization: `Bearer ${jeton}` },
            body:   { titre, photos: [IMAGE] },
            failOnStatusCode: false
        })
    }

    it('refuse un titre déjà porté par une création', function () {
        cy.request({
            url: '/api/photos',
            headers: { Authorization: `Bearer ${this.jeton}` }
        }).then(({ body }) => {
            if (!body.length) {
                cy.log('Aucune création en base — rien à mettre en double.')
                return this.skip()
            }
            const titre = body[0].titre
            tenterAjout(this.jeton, titre).then((res) => {
                expect(res.status, 'ajout refusé').to.eq(409)
                // Le message doit nommer la création fautive : « refusé »
                // tout court laisserait chercher laquelle.
                expect(res.body.erreur).to.contain(titre)
            })
        })
    })

    it('refuse aussi malgré la casse et les espaces', function () {
        // « chouchou » et « Chouchou » sont la même création aux yeux de
        // qui regarde l'album : la règle doit les traiter pareil.
        cy.request({
            url: '/api/photos',
            headers: { Authorization: `Bearer ${this.jeton}` }
        }).then(({ body }) => {
            if (!body.length) return this.skip()
            const deguise = `  ${body[0].titre.toUpperCase()}  `
            tenterAjout(this.jeton, deguise).then((res) => {
                expect(res.status).to.eq(409)
            })
        })
    })

    it('exige un titre qui ne soit pas que des espaces', function () {
        tenterAjout(this.jeton, '   ').then((res) => {
            expect(res.status).to.eq(400)
        })
    })

    // Filet de sécurité. Si un ajout a été accepté alors qu'il aurait dû
    // être refusé, une création traîne dans la base : on la retire.
    //
    // La comparaison se fait sur les identifiants relevés avant
    // l'épreuve, et sur eux seuls. Supprimer « les créations qui portent
    // un titre en double » effacerait des créations bien réelles : deux
    // homonymes peuvent parfaitement coexister dans la base, ce sont
    // justement celles d'avant la règle.
    afterEach(function () {
        if (!this.jeton || !this.idsAvant) return
        const connues = this.idsAvant
        const jeton = this.jeton
        cy.request({
            url: '/api/photos',
            headers: { Authorization: `Bearer ${jeton}` }
        }).then(({ body }) => {
            for (const creation of body) {
                if (connues.has(creation.id)) continue
                cy.log(`Création laissée par un test, supprimée : ${creation.titre}`)
                cy.request({
                    method: 'DELETE',
                    url: `/api/photos/${creation.id}`,
                    headers: { Authorization: `Bearer ${jeton}` }
                })
            }
        })
    })
})
