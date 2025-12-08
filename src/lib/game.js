

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
export async function processSequenceObject(seqObj, moveNumber, startPlayer = 1, selectedTags = [], randomizeOrientation = false) {
  try {
    // Backwards-compatible: sequences stored previously had `moves`/`comments`.
    // Newer stored sequences are SGF-like game objects. If `moves` is not
    // present, derive moves/comments by traversing the single-branch game
    // structure (children chain).
    let movesArray = []
    let commentsArray = []


    // Start from the first child of the game (root node data is seqObj.data)
    let node = (seqObj.children && seqObj.children.length > 0) ? seqObj.children[0] : null

    // Prepare an empty board and apply moves as we encounter them. We
    // determine the player for each move from the node's B/W property. If
    // the first move's color doesn't match `startPlayer`, we'll reverse the
    // color for all moves so the displayed side matches the requested
    // starting player.
    const size = 19
    let signMap = Array.from({ length: size }, () => Array(size).fill(null))

    let totalMovesCount = 0
    let appliedCount = 0

    // Determine the color of the first move in the variation chain so we can
    // decide whether to reverse colors before applying setup stones. This
    // prevents needing to flip root stones afterwards.
    function getFirstMoveColor(seq) {
      if (!seq) return null
      let n = (seq.children && seq.children.length > 0) ? seq.children[0] : null
      while (n) {
        if (n.data) {
          if (n.data.B) return 1
          if (n.data.W) return -1
        }
        n = (n.children && n.children.length > 0) ? n.children[0] : null
      }
      return null
    }

    const firstMoveColor = getFirstMoveColor(seqObj)
    const reverseColors = (firstMoveColor !== null) ? (firstMoveColor !== startPlayer) : false
    const colorForBlack = reverseColors ? -1 : 1
    const colorForWhite = reverseColors ? 1 : -1

    // Process AB/AW/AE setup for any node. We extract this into a helper so
    // we can apply root setup and also setup on the first child node. Setup
    // stones use the already-determined color mapping so they are correct
    // immediately.
    function applySetupFromNode(nodeData) {
      if (!nodeData) return

      if (nodeData.AB) {
        const arr = Array.isArray(nodeData.AB) ? nodeData.AB : [nodeData.AB]
        for (let i = 0; i < arr.length; i++) {
          const mv = arr[i]
          const pos = sgfToPos(mv)
          if (pos) {
            const [x, y] = pos
            signMap[y][x] = { sign: colorForBlack, moveNumber: null }
          }
        }
      }

      if (nodeData.AW) {
        const arr = Array.isArray(nodeData.AW) ? nodeData.AW : [nodeData.AW]
        for (let i = 0; i < arr.length; i++) {
          const mv = arr[i]
          const pos = sgfToPos(mv)
          if (pos) {
            const [x, y] = pos
            signMap[y][x] = { sign: colorForWhite, moveNumber: null }
          }
        }
      }

      if (nodeData.AE) {
        const arr = Array.isArray(nodeData.AE) ? nodeData.AE : [nodeData.AE]
        for (let i = 0; i < arr.length; i++) {
          const mv = arr[i]
          const pos = sgfToPos(mv)
          if (pos) {
            const [x, y] = pos
            if (signMap[y]) signMap[y][x] = null
          }
        }
      }
    }

    // Apply setup from root and also from the first child node (if any).
    if (seqObj && seqObj.data) applySetupFromNode(seqObj.data)
    if (seqObj && seqObj.children && seqObj.children.length > 0 && seqObj.children[0].data) applySetupFromNode(seqObj.children[0].data)

    while (node) {
      if (node.data) {
        // comments: normalize as before (one comment per node)
        if (node.data.C) {
          if (Array.isArray(node.data.C)) {
            // Merge multiple comment entries into one string separated by newlines
            const merged = node.data.C.map(c => String(c || '')).join('\n')
            commentsArray.push(merged || ' ')
          } else commentsArray.push(String(node.data.C || ' '))
        } else commentsArray.push(' ')

        // Process B then W to preserve existing ordering
        const processMove = (moveStr, colorVal) => {
          if (!moveStr) return
          totalMovesCount += 1
          const effectivePlayer = reverseColors ? -colorVal : colorVal

          // Apply only up to requested moveNumber
          appliedCount += 1
          if (appliedCount <= moveNumber) {
            const pos = sgfToPos(moveStr)
            if (pos) signMap = applyMove(signMap, pos, effectivePlayer, appliedCount)
          }
        }

        if (node.data.B) processMove(node.data.B[0], 1)
        if (node.data.W) processMove(node.data.W[0], -1)
      }

      // If selectedTags provided, and this node has tags, stop on this node
      // when any selected tag is present. We include the node's move/comment
      // (already applied above) and then break before traversing further.
      if (Array.isArray(selectedTags) && selectedTags.length > 0 && Array.isArray(node.tags) && node.tags.length > 0) {
        let found = false
        for (let t = 0; t < selectedTags.length; t++) {
          if (node.tags.indexOf(selectedTags[t]) !== -1) { found = true; break }
        }
        if (found) break
      }

      node = (node.children && node.children.length > 0) ? node.children[0] : null
    }

    const totalMoves = totalMovesCount

    // root setup stones were applied with the final color mapping above,
    // so there's no need to flip them here.

    // Apply orientation randomization if requested
    let finalSignMap = signMap
    if (randomizeOrientation) {
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
      totalMoves: totalMoves,
      comments: Array.isArray(seqObj.comments) ? seqObj.comments : commentsArray
    }
  } catch (err) {
    console.error('Error processing sequence object:', err)
    throw err
  }
}