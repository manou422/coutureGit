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

// Les deux programmes à lancer. `cwd` = le dossier depuis lequel la
// commande est exécutée, `couleur` un code ANSI pour teinter le préfixe
// dans le terminal et distinguer qui parle.
const parties = [
    { nom: 'api ', couleur: '\x1b[36m', commande: 'npm start',   cwd: __dirname },
    { nom: 'site', couleur: '\x1b[35m', commande: 'npm run dev', cwd: path.join(__dirname, 'album') },
]

const enfants = []  // les deux processus lancés, pour pouvoir les arrêter
let arretEnCours = false  // évite que chaque arrêt en déclenche un autre

for (const partie of parties) {
    // Commande passée d'un bloc plutôt qu'en (programme, arguments) :
    // sous Windows npm est un .cmd, qui exige le shell, et Node
    // déconseille de combiner shell et tableau d'arguments.
    const enfant = spawn(partie.commande, { cwd: partie.cwd, shell: true })
    enfants.push(enfant)

    // Chaque ligne écrite par un programme est réaffichée précédée de son
    // nom : sans cela, les deux sorties se mélangeraient sans qu'on sache
    // laquelle vient de quoi.
    // Chaque ligne écrite par un programme est réaffichée précédée de son
    // nom : sans cela, les deux sorties se mélangeraient sans qu'on sache
    // laquelle vient de quoi.
    //
    // La fonction est fabriquée deux fois, une par flux de sortie : ce
    // qu'un programme écrit sur sa sortie d'erreur doit rester sur la
    // nôtre, sans quoi les messages d'erreur seraient noyés.
    const prefixerVers = (flux) => (donnees) => {
        for (const ligne of donnees.toString().split('\n')) {
            if (!ligne.trim()) continue
            flux.write(`${partie.couleur}[${partie.nom}]\x1b[0m ${ligne}\n`)
        }
    }

    enfant.stdout.on('data', prefixerVers(process.stdout))
    enfant.stderr.on('data', prefixerVers(process.stderr))

    // Si une moitié tombe, l'autre ne sert à rien : on arrête tout plutôt
    // que de laisser un site sans API, dont les symptômes sont trompeurs.
    enfant.on('exit', (code) => {
        if (arretEnCours) return
        console.error(`\n[${partie.nom}] s'est arrêté (code ${code}). Arrêt de l'ensemble.`)
        tuerTout()
        process.exit(code ?? 1)
    })
}


// Arrête les processus encore vivants (`exitCode === null` = toujours en cours).
function tuerTout() {
    arretEnCours = true
    for (const e of enfants) {
        if (e.exitCode === null) e.kill()
    }
}

// Ctrl+C (SIGINT) ou une demande d'arrêt du système (SIGTERM) ne
// toucheraient que ce script : on transmet donc aux deux enfants,
// sinon ils continueraient à tourner en arrière-plan.
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { tuerTout(); process.exit(0) })
}

console.log('API sur http://localhost:3000 — site sur http://localhost:5173')
console.log('Ctrl+C arrête les deux.\n')
