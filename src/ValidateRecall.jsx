import { useEffect, useState } from 'preact/hooks'
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

  useEffect(() => {
    // Load test moves from localStorage
    const savedTestMoves = localStorage.getItem('testMoves')
    if (savedTestMoves) {
      const moves = JSON.parse(savedTestMoves)
      setTestMoves(moves)
      // Reconstruct test board from moves
      const board = Array(19).fill().map(() => Array(19).fill(0))
      moves.forEach(move => {
        board[move.y][move.x] = { sign: move.sign, moveNumber: move.moveNumber }
      })
      setTestBoard(board)
    }
  }, []) // Load test moves once on mount

  // Separate effect for loading SGF - runs when testMoves changes
  useEffect(() => {
    async function loadSGF() {
      try {
        const sgfContent = localStorage.getItem('lastSgfContent')
        if (!sgfContent) {
          setError('No SGF file selected. Go back and load an SGF file first.')
          setLoading(false)
          return
        }
        
        // Create a Blob from the stored content and wrap in a File object
        const blob = new Blob([sgfContent], { type: 'application/x-go-sgf' })
        const file = new File([blob], 'stored.sgf', { type: 'application/x-go-sgf' })
        
        const { signMap, totalMoves } = await processGame(file, moveNumber)
        setSgfBoard(signMap)
        setSgfMoves(moves => [...moves, { signMap, totalMoves }])
        validate(testMoves, signMap)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadSGF()
  }, [testMoves]) // Run when testMoves changes

  function validate(testMoves, sgfBoard) {
    if (testMoves.length === 0) {
      setValidationMessage('No moves to validate')
      return
    }

    // Compare each test move with the corresponding position in the SGF board
    const mismatches = testMoves.map(move => {
      const sgfCell = sgfBoard[move.y][move.x]
      const sgfSign = sgfCell?.sign || 0

      if (sgfSign !== move.sign) {
        return {
          moveNumber: move.moveNumber
        }
      }
      return null
    }).filter(Boolean) // Remove nulls for matching moves

    if (mismatches.length === 0 && moveNumber === testMoves.length) {
      setValidationMessage('All moves match! 🎉')
    } else {
      const mismatchList = mismatches
        .map(m => `Move ${m.moveNumber}`)
        .join('\n')
      setValidationMessage(`Found ${mismatches.length} incorrect moves:\n${mismatchList}`)
    }
    if (moveNumber > testMoves.length) {
        setValidationMessage(prev => prev + `\nYou have set to review up to move ${moveNumber}, but only ${testMoves.length} moves were made.`)
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
      <h2>Validate Recall</h2>
      
      <div style={{ 
        display: 'flex', 
        gap: '2rem',
        flexWrap: 'wrap',
        alignItems: 'flex-start'
      }}>

        <div>
          <h3>Your Moves</h3>
          <Goban
            signMap={testBoard.map(row => row.map(cell => cell?.sign || 0))}
            markerMap={testBoard.map(row => 
              row.map(cell => cell?.moveNumber ? 
                ({ type: 'label', label: cell.moveNumber.toString() }) : 
                null
              )
            )}
            vertexSize={28}
            showCoordinates={true}
          />
        </div>

        <div>
          <h3>SGF Moves</h3>
          <Goban
            signMap={sgfBoard.map(row => row.map(cell => cell?.sign || 0))}
            markerMap={sgfBoard.map(row => 
                row.map(cell => cell?.moveNumber ? 
                { type: 'label', label: cell.moveNumber.toString() } : 
                null
                )
            )}
            vertexSize={28}
            showCoordinates={true}
          />
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
          
          window.location.hash = null
        }}>
          Next Move
        </button>
      </div>
    </div>
  )
}