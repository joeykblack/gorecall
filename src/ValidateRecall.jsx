import { useEffect, useState, useRef } from 'preact/hooks'
import '@sabaki/shudan/css/goban.css'
import { Goban } from '@sabaki/shudan'
import { processGame } from './lib/game'

export default function ValidateRecall() {
  const [testMoves, setTestMoves] = useState([])
  const [sgfMoves, setSgfMoves] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [validationMessage, setValidationMessage] = useState('')
  const [sgfBoard, setSgfBoard] = useState(() => Array(19).fill().map(() => Array(19).fill(null)))
  const [testBoard, setTestBoard] = useState(() => Array(19).fill().map(() => Array(19).fill(null)))
  const [moveNumber, setMoveNumber] = useState(() => {
    const saved = localStorage.getItem('moveNumber')
    return saved ? parseInt(saved, 10) : 0
  })

  // Responsive sizing for each Goban in this view
  const testBoardRef = useRef(null)
  const sgfBoardRef = useRef(null)
  const [computedTestVertexSize, setComputedTestVertexSize] = useState(28)
  const [computedSgfVertexSize, setComputedSgfVertexSize] = useState(28)

  useEffect(() => {
    const maxVertex = 32
    const minVertex = 12
    const boardPadding = 16

    function recompute() {
      const testContainer = testBoardRef.current
      const sgfContainer = sgfBoardRef.current
      const size = 19

      const availableWidthTest = testContainer ? testContainer.clientWidth : window.innerWidth
      const tentativeTest = Math.floor((availableWidthTest - 2 * boardPadding) / (Math.max(1, size + 1)))
      setComputedTestVertexSize(Math.max(minVertex, Math.min(maxVertex, tentativeTest)))

      const availableWidthSgf = sgfContainer ? sgfContainer.clientWidth : window.innerWidth
      const tentativeSgf = Math.floor((availableWidthSgf - 2 * boardPadding) / (Math.max(1, size + 1)))
      setComputedSgfVertexSize(Math.max(minVertex, Math.min(maxVertex, tentativeSgf)))
      
    }

    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('orientationchange', recompute)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('orientationchange', recompute)
    }
  }, [])

  useEffect(() => {
    // Load test moves from localStorage
    const savedTestMoves = localStorage.getItem('testMoves')
    if (savedTestMoves) {
      const moves = JSON.parse(savedTestMoves)
      setTestMoves(moves)
      // Reconstruct test board from moves. Skip pass moves (no x/y).
      const board = Array(19).fill().map(() => Array(19).fill(0))
      moves.forEach(move => {
        // Only place stones for moves with valid coordinates
        if (Number.isInteger(move.x) && Number.isInteger(move.y) && move.x >= 0 && move.x < 19 && move.y >= 0 && move.y < 19) {
          board[move.y][move.x] = { sign: move.sign, moveNumber: move.moveNumber }
        }
        // If move.x/move.y are missing, it's a pass — nothing to draw on the board
      })
      setTestBoard(board)
    }
  }, []) // Load test moves once on mount

  // Separate effect for loading SGF - runs when testMoves changes
  useEffect(() => {
    async function loadSGF() {
      try {
        // Prefer using the processed result persisted by App to avoid re-processing the SGF
        const lastProcessedRaw = localStorage.getItem('lastProcessed')
        if (lastProcessedRaw) {
            const parsed = JSON.parse(lastProcessedRaw)
            if (parsed && parsed.moveNumber === moveNumber && parsed.signMap) {
              setSgfBoard(parsed.signMap)
              setSgfMoves(m => [...m, { signMap: parsed.signMap, totalMoves: parsed.totalMoves }])
              validate(testMoves, parsed.signMap, parsed.totalMoves)
              setLoading(false)
            }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadSGF()
  }, [testMoves]) // Run when testMoves changes

  function validate(testMoves, sgfBoard, totalSgfMoves) {
    if (testMoves.length === 0) {
      setValidationMessage('No moves to validate')
      return
    }

    // Compare each test move with the corresponding position in the SGF board
    const mismatches = testMoves.map(move => {
      // Handle pass moves (no x/y): validate that no SGF cell has that moveNumber
      if (!Number.isInteger(move.x) || !Number.isInteger(move.y)) {
        // Search SGF board for a cell with this moveNumber
        let found = false
        for (let r = 0; r < sgfBoard.length && !found; r++) {
          for (let c = 0; c < sgfBoard[r].length; c++) {
            const cell = sgfBoard[r][c]
            if (cell && cell.moveNumber === move.moveNumber) {
              found = true
              break
            }
          }
        }
        if (found) {
          return { moveNumber: move.moveNumber }
        }
        return null
      }

      // Normal move with coordinates
      if (move.y < 0 || move.y >= sgfBoard.length || move.x < 0 || move.x >= sgfBoard[0].length) {
        return { moveNumber: move.moveNumber }
      }

      const sgfCell = sgfBoard[move.y][move.x]
      const sgfSign = sgfCell?.sign || 0

      if (sgfSign !== move.sign || move.moveNumber !== sgfCell?.moveNumber) {
        return { moveNumber: move.moveNumber }
      }
      return null
    }).filter(Boolean) // Remove nulls for matching moves

    if (mismatches.length === 0 && totalSgfMoves === testMoves.length) {
      setValidationMessage('All moves match! 🎉')
    } else {
      const mismatchList = mismatches
        .map(m => `Move ${m.moveNumber}`)
        .join('\n')
      setValidationMessage(`Found ${mismatches.length} incorrect moves:\n${mismatchList}`)
    }
    if (totalSgfMoves > testMoves.length) {
        // TODO: sometimes triggers incorrectly
        // setValidationMessage(prev => prev + `\nSequence had ${totalSgfMoves} moves, but only ${testMoves.length} moves were made.`)
    }
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => history.back()}>Go Back</button>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: '1rem' }}>Loading...</div>
  }

  return (
    <div className="app">
      <div className="app-content">
        <h2>Validate Recall</h2>

        <div style={{ 
            display: 'flex', 
            gap: '2rem',
            flexWrap: 'wrap',
            alignItems: 'flex-start'
        }}>

          <div>
            <h3>Your Moves</h3>
            <div ref={testBoardRef} >
              <Goban
                signMap={testBoard.map(row => row.map(cell => cell?.sign || 0))}
                markerMap={testBoard.map(row => 
                  row.map(cell => cell?.moveNumber ? ({ type: 'label', label: cell.moveNumber.toString() }) : null)
                )}
                vertexSize={computedTestVertexSize}
                showCoordinates={true}
                style={{ margin: '0.5rem 0' }}
              />
            </div>
          </div>

          <div>
            <h3>SGF Moves</h3>
            <div ref={sgfBoardRef}>
              <Goban
                signMap={sgfBoard.map(row => row.map(cell => cell?.sign || 0))}
                markerMap={sgfBoard.map(row => 
                  row.map(cell => cell?.moveNumber ? ({ type: 'label', label: cell.moveNumber.toString() }) : null)
                )}
                vertexSize={computedSgfVertexSize}
                showCoordinates={true}
                style={{ margin: '0.5rem 0' }}
              />
            </div>
          </div>

        </div>

        <div style={{ 
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: validationMessage.includes('match') ? '#e6ffe6' : '#ffe6e6',
            borderRadius: '4px',
            whiteSpace: 'pre-line'
        }}>
            <strong>Result:</strong>
            <p>{validationMessage}</p>
        </div>

        <div style={{ 
            marginTop: '1rem',
            display: 'flex',
            gap: '1rem',
        }}>
                  <button onClick={() => history.back()}>
                      Try Again
                  </button>
                  <button onClick={() => {
                      window.location.hash = null
                  }}>
                      Restart
                  </button>
                  <button onClick={() => {
                      window.dispatchEvent(new CustomEvent('moveNumberChanged', { detail: moveNumber }))
                      window.location.hash = null
                  }}>
                      Next
                  </button>
                  <button onClick={() => {
                      const newNumber = (moveNumber || 0) + 1
                      setMoveNumber(newNumber)
                      localStorage.setItem('moveNumber', newNumber.toString())
                      // Notify the rest of the app in this window that the move number changed
                      window.dispatchEvent(new CustomEvent('moveNumberChanged', { detail: newNumber }))
                      // Go back to the main app view
                      window.location.hash = null
                  }}>
                      Next +1 Move
                  </button>
        </div>
      </div>
    </div>
  )
}