import { parse, stringify } from '@sabaki/sgf'

export async function reviewToTraining(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (evt) => {
      try {
        const sgfContent = evt.target.result
        const games = parse(sgfContent)
        if (!games || games.length === 0) throw new Error('No games found in SGF')

        const game = games[0] // Assume first game

        const trainingGames = []

        // Collect all branch sequences
        function collectBranches(node, pathMoves = []) {
          if (!node) return

          // Clone current path
          const currentPath = [...pathMoves]

          // Add moves from this node
          if (node.data) {
            if (node.data.B) currentPath.push({ color: 'B', coord: node.data.B[0] })
            if (node.data.W) currentPath.push({ color: 'W', coord: node.data.W[0] })
          }

          if (node.children && node.children.length > 1) {
            // Branch point: first child is main line, others are branches
            for (let i = 1; i < node.children.length; i++) {
              const branch = node.children[i]
              // Create training game for this branch
              const trainingGame = createTrainingGame(currentPath, branch)
              trainingGames.push(trainingGame)
            }
          }

          // Recurse into first child (main line)
          if (node.children && node.children.length > 0) {
            collectBranches(node.children[0], currentPath)
          }

          // Also recurse into other children to find further branches
          if (node.children && node.children.length > 1) {
            for (let i = 1; i < node.children.length; i++) {
              collectBranches(node.children[i], currentPath)
            }
          }
        }

        function createTrainingGame(pathMoves, branchNode) {
          // Separate black and white moves
          const blackStones = []
          const whiteStones = []

          pathMoves.forEach(move => {
            if (move.color === 'B') blackStones.push(move.coord)
            else if (move.color === 'W') whiteStones.push(move.coord)
          })

          // Create root node with AB/AW
          const rootNode = {
            data: {
              AB: blackStones.length > 0 ? blackStones : undefined,
              AW: whiteStones.length > 0 ? whiteStones : undefined
            },
            children: [branchNode] // The branch starts here
          }

          return rootNode
        }

        // Start collecting from root
        collectBranches(game)

        // Create a single SGF with all training games under one root
        const singleGame = {
          data: game.data || {}, // Copy original root properties
          children: trainingGames
        }

        // Create SGF string
        const newSgfContent = stringify([singleGame])

        // Return as a new File object
        const newFile = new File([newSgfContent], `training_${file.name}`, { type: 'application/x-go-sgf' })

        resolve(newFile)
      } catch (error) {
        console.error('Error converting review to training:', error)
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}