// Utilities for parsing and applying SGF moves
import { parseFile } from './sgf'

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

// Process an SGF file and return moves up to moveNumber
// startPlayer: 1 for black, -1 for white. Defaults to black.
export async function processGame(file, moveNumber, startPlayer = 1) {
  try {
    const sgf = await parseFile(file)
    if (!sgf || !sgf.moves || !sgf.moves.length) {
      throw new Error('No moves found in SGF file')
    }

  // Start with an empty board
    const size = 19
    let signMap = Array.from({ length: size }, () => Array(size).fill(null))
    
  // Apply moves up to moveNumber
  const movesToApply = sgf.moves.slice(0, moveNumber)
  let player = startPlayer // Start with provided player

    movesToApply.forEach((move, index) => {
      const pos = sgfToPos(move)
      if (pos) {
        signMap = applyMove(signMap, pos, player, index + 1) // Pass move number (1-based)
      } // else pass
      player = -player // Switch players
    })

    // Randomly transform the board if randomizeOrientation is set
    let finalSignMap = signMap
    if (window.randomizeOrientation) {
      // Randomly choose number of 90-degree rotations (0-3)
      const rotations = Math.floor(Math.random() * 4)
      
      // Randomly decide whether to transpose
      const shouldTranspose = Math.random() < 0.5
      
      // Apply rotations
      for (let i = 0; i < rotations; i++) {
        finalSignMap = finalSignMap.map((row, i) => 
          row.map((_, j) => finalSignMap[finalSignMap.length - 1 - j][i])
        )
      }
      
      // Apply transposition if selected
      if (shouldTranspose) {
        finalSignMap = finalSignMap.map((row, i) => 
          row.map((_, j) => finalSignMap[j][i])
        )
      }
    }
    
    return {
      signMap: finalSignMap,
      totalMoves: sgf.moves.length,
      comments: sgf.comments || []
    }
  } catch (err) {
    console.error('Error processing SGF:', err)
    throw err
  }
}

// Process a sequence object previously stored in localStorage. The sequence
// object must have the shape { moves: string[], comments: string[] } where
// moves are SGF two-letter coordinates (e.g., 'pd'). Returns the same shape
// as processGame: { signMap, totalMoves, comments }.
export async function processSequenceObject(seqObj, moveNumber, startPlayer = 1) {
  try {
    const movesArray = Array.isArray(seqObj.moves) ? seqObj.moves : []
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
      comments: Array.isArray(seqObj.comments) ? seqObj.comments : []
    }
  } catch (err) {
    console.error('Error processing sequence object:', err)
    throw err
  }
}