import { parse } from '@sabaki/sgf'
import { saveSequence } from './seqDB'


// Read a File and split it into sequences (one per leaf) using DFS.
// Each sequence is written directly to localStorage as a JSON object to avoid
// keeping large amounts of data in memory. Returns an array of metadata
// objects describing stored sequences: { key, name, firstMove, totalMoves }.
export async function splitFileIntoSequences(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

  reader.onload = async (evt) => {
      try {
        const sgfContent = evt.target.result
        const [game] = parse(sgfContent)
        if (!game) throw new Error('No game found in SGF')

        const sequencesMeta = []
        let seqCount = 0

        // Traverse tree depth-first and collect moves/comments along the path
        // Additionally build a chain of node clones (each with { data, children })
        // so we can construct a minimal SGF-game object that contains only the
        // root node and the sequence branch.
        async function dfs(node, nodeClonesAcc) {
          if (!node) return

          let nodeClones = nodeClonesAcc.slice()

          // Clone this node minimally: include its data and an empty children
          // array; we'll wire children together when we store the sequence.
          const nodeClone = { data: node.data ? JSON.parse(JSON.stringify(node.data)) : {}, children: [] }
          nodeClones.push(nodeClone)


          if (!node.children || node.children.length === 0) {
            // Leaf: store this sequence as a minimal SGF-like game object in
            // IndexedDB. We will create a game-shaped object that includes
            // only the root node and the chain of nodes for this sequence.
            seqCount += 1

            // If we collected any node clones for the sequence, wire them up
            // into a single-branch children chain so the structure matches a
            // parsed SGF game's shape.
            if (nodeClones.length > 1) {
              // Link chain: each clone's children = [nextClone]
              for (let i = 0; i < nodeClones.length - 1; i++) {
                nodeClones[i].children = [nodeClones[i + 1]]
              }
            }

            const seqObj = {
              // Store the root node's data rather than a non-existent `nodes` array.
              data: game.data ? JSON.parse(JSON.stringify(game.data)) : {},
              children: nodeClones.length > 0 ? [nodeClones[0]] : [],
              info: {
                fileName: file.name || null,
                createdAt: Date.now()
              }
            }

            // Use a stable key that includes the original file name (sanitized)
            // and the sequence index. Avoid date/random components so keys are
            // easier to correlate with the source file.
            const safeName = (file.name || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_')
            const key = `seq:${safeName}:${seqCount}`
            try {
              await saveSequence(key, seqObj)
            } catch (e) {
              // If storage fails, reject
              return reject(new Error('Failed to write sequence to IndexedDB: ' + e.message))
            }

            sequencesMeta.push({ key, name: `${file.name}#${seqCount}` })
            return
          }

          // Recurse into children
          for (let i = 0; i < node.children.length; i++) {
            await dfs(node.children[i], nodeClones)
          }
        }

        // Walk each top-level variation (children of the root)
        for (let i = 0; i < (game.children || []).length; i++) {
          await dfs(game.children[i], [])
        }

        resolve(sequencesMeta)
      } catch (err) {
        console.error('SGF split error:', err)
        reject(new Error('Failed to split SGF file: ' + err.message))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}