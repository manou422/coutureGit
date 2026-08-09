// Démarre les deux moitiés du projet d'un coup :
//   - l'API Express + MySQL      (server.js, port 3000)
//   - le site Vue avec Vite      (album/,    port 5173)
//
// En production un seul programme fait les deux ; en développement Vite
// tourne à part pour offrir le rechargement à chaud. Ce script évite
// d'avoir à ouvrir deux terminaux — et d'oublier le second.
//
// Usage : npm run dev   (à la racine du projet)

const { spawn } = require('child_process')
const path      = require('path')

const parties = [
    { nom: 'api ', couleur: '\x1b[36m', commande: 'npm start',   cwd: __dirname },
    { nom: 'site', couleur: '\x1b[35m', commande: 'npm run dev', cwd: path.join(__dirname, 'album') },
]

const enfants = []
let arretEnCours = false

for (const partie of parties) {
    // Commande passée d'un bloc plutôt qu'en (programme, arguments) :
    // sous Windows npm est un .cmd, qui exige le shell, et Node
    // déconseille de combiner shell et tableau d'arguments.
    const enfant = spawn(partie.commande, { cwd: partie.cwd, shell: true })
    enfants.push(enfant)

    const prefixer = (flux) => (donnees) => {
        for (const ligne of donnees.toString().split('\n')) {
            if (ligne.trim()) flux.write(`${partie.couleur}[${partie.nom}]\x1b[0m ${ligne}\n`)
        }
    }
    enfant.stdout.on('data', prefixer(process.stdout))
    enfant.stderr.on('data', prefixer(process.stderr))

    // Si une moitié tombe, l'autre ne sert à rien : on arrête tout plutôt
    // que de laisser un site sans API, dont les symptômes sont trompeurs.
    enfant.on('exit', (code) => {
        if (arretEnCours) return
        console.error(`\n[${partie.nom}] s'est arrêté (code ${code}). Arrêt de l'ensemble.`)
        tuerTout()
        process.exit(code ?? 1)
    })
}

function tuerTout() {
    arretEnCours = true
    for (const e of enfants) {
        if (e.exitCode === null) e.kill()
    }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { tuerTout(); process.exit(0) })
}

console.log('API sur http://localhost:3000 — site sur http://localhost:5173')
console.log('Ctrl+C arrête les deux.\n')
