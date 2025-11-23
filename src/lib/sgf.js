import { parse } from '@sabaki/sgf'

export async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = evt => {
      try {
        const sgfContent = evt.target.result
        const [game] = parse(sgfContent)
        
        if (!game) {
          throw new Error('No game found in SGF')
        }

        // Extract moves and comments by traversing the game tree
        const moves = []
        const comments = []
        
        // Function to extract moves recursively, following the main variation
        function extractMoves(node) {
          if (!node) return
          
          // Process all nodes in current sequence
          if (node.data) {
            if (node.data.B) {
              moves.push(node.data.B[0])
            }
            if (node.data.W) {
              moves.push(node.data.W[0])
            }
            if (node.data.C) {
              comments.push(node.data.C[0])
            } else {
                comments.push(" ")
            }
          }
          
          // Select which variation to follow
          if (node.children && node.children.length > 0) {
            if (window.randomizeVariation && node.children.length > 1) {
              // Randomly select a child
              const randomIndex = Math.floor(Math.random() * node.children.length)
              extractMoves(node.children[randomIndex])
            } else {
              // Follow main variation (first child)
              extractMoves(node.children[0])
            }
          }
        }

        var startNode = game.children?.[0] || null
        // If at root node and we have a starting position preference
        if (game.children.length > 1 && window.startPos) {
            // Find child node matching the starting position
            const matchingChild = game.children.find(child => 
            child.data?.B?.[0] === window.startPos
            )
            startNode = matchingChild || game.children[0]
        } else if (game.children.length > 1 && window.randomizeVariation) {
              const randomIndex = Math.floor(Math.random() * game.children.length)
              startNode = game.children[randomIndex]
        }
        
        // Start extracting from the game root
        extractMoves(startNode)
        
        // Get game info from root node if available
        const rootNode = game.nodes?.[0] || {}
        resolve({ 
          moves,
          comments,
          info: {
            playerBlack: rootNode.PB?.[0] || null,
            playerWhite: rootNode.PW?.[0] || null,
            result: rootNode.RE?.[0] || null,
            size: parseInt(rootNode.SZ?.[0] || '19', 10),
            komi: parseFloat(rootNode.KM?.[0] || '6.5'),
          }
        })
      } catch (err) {
        console.error('SGF Parse error:', err)
        reject(new Error('Failed to parse SGF file: ' + err.message))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

// Read a File and split it into sequences (one per leaf) using DFS.
// Each sequence is written directly to localStorage as a JSON object to avoid
// keeping large amounts of data in memory. Returns an array of metadata
// objects describing stored sequences: { key, name, firstMove, totalMoves }.
export async function splitFileIntoSequences(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = evt => {
      try {
        const sgfContent = evt.target.result
        const [game] = parse(sgfContent)
        if (!game) throw new Error('No game found in SGF')

        const sequencesMeta = []
        let seqCount = 0

        // Traverse tree depth-first and collect moves/comments along the path
        function dfs(node, movesAcc, commentsAcc) {
          if (!node) return

          let moves = movesAcc.slice()
          let comments = commentsAcc.slice()

          if (node.data) {
            if (node.data.B) moves.push(node.data.B[0])
            if (node.data.W) moves.push(node.data.W[0])
            if (node.data.C) comments.push(node.data.C[0])
            else comments.push(' ')
          }

          if (!node.children || node.children.length === 0) {
            // Leaf: store this sequence as a small object in localStorage
            seqCount += 1
            const seqObj = {
              moves,
              comments,
              info: {
                fileName: file.name || null,
                createdAt: Date.now()
              }
            }

            const key = `sequence:${Date.now()}:${Math.floor(Math.random() * 1e6)}:${seqCount}`
            try {
              localStorage.setItem(key, JSON.stringify(seqObj))
            } catch (e) {
              // If storage fails, reject
              return reject(new Error('Failed to write sequence to localStorage: ' + e.message))
            }

            sequencesMeta.push({ key, name: `${file.name}#${seqCount}`, firstMove: moves[0] || null, totalMoves: moves.length })
            return
          }

          // Recurse into children
          for (let i = 0; i < node.children.length; i++) {
            dfs(node.children[i], moves, comments)
          }
        }

        const startNode = game.children?.[0] || null
        dfs(startNode, [], [])

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