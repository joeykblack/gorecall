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