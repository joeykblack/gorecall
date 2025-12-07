

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
    let firstMoveColor = null
    let reverseColors = false

    // Process AB/AW/AE setup for any node. We extract this into a helper so
    // we can apply root setup and also setup on the first child node.
    const rootPositions = []
    function applySetupFromNode(nodeData) {
      if (!nodeData) return

      if (nodeData.AB) {
        const arr = Array.isArray(nodeData.AB) ? nodeData.AB : [nodeData.AB]
        for (let i = 0; i < arr.length; i++) {
          const mv = arr[i]
          const pos = sgfToPos(mv)
          if (pos) {
            const [x, y] = pos
            signMap[y][x] = { sign: 1, moveNumber: null }
            rootPositions.push([x, y])
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
            signMap[y][x] = { sign: -1, moveNumber: null }
            rootPositions.push([x, y])
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
            // remove from rootPositions if present
            for (let ri = rootPositions.length - 1; ri >= 0; ri--) {
              const rp = rootPositions[ri]
              if (rp[0] === x && rp[1] === y) rootPositions.splice(ri, 1)
            }
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
          if (Array.isArray(node.data.C)) commentsArray.push(String(node.data.C[0] || ' '))
          else commentsArray.push(String(node.data.C || ' '))
        } else commentsArray.push(' ')

        // Process B then W to preserve existing ordering
        const processMove = (moveStr, colorVal) => {
          if (!moveStr) return
          totalMovesCount += 1
          if (firstMoveColor === null) {
            firstMoveColor = colorVal
            // If the provided startPlayer doesn't match the first move's
            // color, we will reverse all colors.
            reverseColors = (firstMoveColor !== startPlayer)
          }

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

    // If we discovered that move colors needed to be reversed after we had
    // already placed root setup stones, flip those root stones so their
    // colors match the displayed moves.
    if (reverseColors && rootPositions.length > 0) {
      for (let i = 0; i < rootPositions.length; i++) {
        const [x, y] = rootPositions[i]
        const cell = signMap[y] && signMap[y][x]
        if (cell && typeof cell.sign === 'number') {
          cell.sign = -cell.sign
        }
      }
    }

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