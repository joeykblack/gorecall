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

        // Extract moves by traversing the game tree
        const moves = []
        
        // Function to extract moves recursively, following the main variation
        function extractMoves(node) {
          if (!node) return
          
          // Process all nodes in current sequence
          if (node.data) {
            if (node.data.B) moves.push(node.data.B[0])
            if (node.data.W) moves.push(node.data.W[0])
        }
          
          // Follow main variation (first child)
          if (node.children && node.children.length > 0) {
            extractMoves(node.children[0])
          }
        }
        
        // Start extracting from the game root
        extractMoves(game)
        
        // Get game info from root node if available
        const rootNode = game.nodes?.[0] || {}
        resolve({ 
          moves,
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