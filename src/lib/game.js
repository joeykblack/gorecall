

// Convert SGF move coordinate (e.g., "pd") to board coordinates [x, y]
export function sgfToPos(move) {
  if (!move || typeof move !== 'string' || move.length !== 2) return null
  const x = move.charCodeAt(0) - 97 // 'a' -> 0
  const y = move.charCodeAt(1) - 97 // 'a' -> 0
  return [x, y]
}

// Create a new board position (signMap) by applying a move
export function applyMove(prevSignMap, pos, player, moveNumber) {
  if (!pos) return prevSignMap
  const [x, y] = pos

  // Copy the previous board state
  const newSignMap = prevSignMap.map(row => [...row])

  // Apply the move with sequence number
  if (x >= 0 && x < 19 && y >= 0 && y < 19) {
    newSignMap[y][x] = { sign: player, moveNumber } // Store both color and move number
  }

  return newSignMap
}


// Process a sequence object previously stored in localStorage. The sequence
// object must have the shape { moves: string[], comments: string[] } where
// moves are SGF two-letter coordinates (e.g., 'pd'). Returns the same shape
// as processGame: { signMap, totalMoves, comments }.
// `selectedTags` is an optional array of tag strings. If provided, traversal
// will stop (include that node) when a node contains any of the selected
// tags in its `tags` array.
export async function processSequenceObject(seqObj, moveNumber, startPlayer = 1, selectedTags = []) {
  try {
    // Backwards-compatible: sequences stored previously had `moves`/`comments`.
    // Newer stored sequences are SGF-like game objects. If `moves` is not
    // present, derive moves/comments by traversing the single-branch game
    // structure (children chain).
    let movesArray = []
    let commentsArray = []


    // Start from the first child of the game (root node data is seqObj.data)
    let node = (seqObj.children && seqObj.children.length > 0) ? seqObj.children[0] : null
    while (node) {
      if (node.data) {
        if (node.data.B) movesArray.push(node.data.B[0])
        if (node.data.W) movesArray.push(node.data.W[0])
        if (node.data.C) {
          // Normalize comment prop (parser may produce array or string)
          if (Array.isArray(node.data.C)) commentsArray.push(String(node.data.C[0] || ' '))
          else commentsArray.push(String(node.data.C || ' '))
        } else commentsArray.push(' ')
      }

      // If selectedTags provided, and this node has tags, stop on this node
      // when any selected tag is present. We include the node's move/comment
      // and then break before traversing further.
      if (Array.isArray(selectedTags) && selectedTags.length > 0 && Array.isArray(node.tags) && node.tags.length > 0) {
        // check intersection
        let found = false
        for (let t = 0; t < selectedTags.length; t++) {
          if (node.tags.indexOf(selectedTags[t]) !== -1) { found = true; break }
        }
        if (found) break
      }

      node = (node.children && node.children.length > 0) ? node.children[0] : null
    }

    // Start with an empty board
    const size = 19
    let signMap = Array.from({ length: size }, () => Array(size).fill(null))

    const movesToApply = movesArray.slice(0, moveNumber)
    let player = startPlayer

    movesToApply.forEach((move, index) => {
      const pos = sgfToPos(move)
      if (pos) {
        signMap = applyMove(signMap, pos, player, index + 1)
      }
      player = -player
    })

    // Apply orientation randomization if requested
    let finalSignMap = signMap
    if (window.randomizeOrientation) {
      const rotations = Math.floor(Math.random() * 4)
      const shouldTranspose = Math.random() < 0.5
      for (let i = 0; i < rotations; i++) {
        finalSignMap = finalSignMap.map((row, i) => row.map((_, j) => finalSignMap[finalSignMap.length - 1 - j][i]))
      }
      if (shouldTranspose) {
        finalSignMap = finalSignMap.map((row, i) => row.map((_, j) => finalSignMap[j][i]))
      }
    }

    return {
      signMap: finalSignMap,
      totalMoves: movesArray.length,
      comments: Array.isArray(seqObj.comments) ? seqObj.comments : commentsArray
    }
  } catch (err) {
    console.error('Error processing sequence object:', err)
    throw err
  }
}