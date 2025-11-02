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
  const [sgfBoard, setSgfBoard] = useState(() => Array(19).fill().map(() => Array(19).fill(0)))
  const [testBoard, setTestBoard] = useState(() => Array(19).fill().map(() => Array(19).fill(0)))

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

    // Load and process SGF
    async function loadSGF() {
      try {
        const filePath = localStorage.getItem('lastSgfPath')
        if (!filePath) {
          setError('No SGF file selected. Go back and load an SGF file first.')
          setLoading(false)
          return
        }
        
        const moveCount = testMoves.length
        const { signMap, totalMoves } = await processGame(filePath, moveCount)
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
  }, [])

  function validate(testMoves, sgfBoard) {
    let isValid = true
    let message = ''

    if (testMoves.length === 0) {
      setValidationMessage('No moves to validate')
      return
    }

    // Compare each test move with the corresponding position in the SGF board
    testMoves.forEach(move => {
      const sgfCell = sgfBoard[move.y][move.x]
      const sgfSign = sgfCell?.sign || 0

      if (sgfSign !== move.sign) {
        isValid = false
        message = `Mismatch at move ${move.moveNumber}: ${move.sign === 1 ? 'Black' : 'White'} stone was played at ${String.fromCharCode(97 + move.x)}${String.fromCharCode(97 + move.y)}, but the SGF shows ${sgfSign === 1 ? 'Black' : sgfSign === -1 ? 'White' : 'no stone'}`
      }
    })

    setValidationMessage(isValid ? 'All moves match! 🎉' : message)
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
    <div style={{ padding: '1rem' }}>
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
            signMap={sgfBoard}
            markerMap={sgfBoard.map((row, y) => 
              row.map((cell, x) => {
                const move = testMoves.find(m => m.x === x && m.y === y)
                return move ? 
                  ({ type: 'label', label: move.moveNumber.toString() }) : 
                  null
              })
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
        borderRadius: '4px'
      }}>
        <strong>Validation Result:</strong>
        <p>{validationMessage}</p>
      </div>

      <button 
        onClick={() => history.back()}
        style={{ marginTop: '1rem' }}
      >
        Go Back
      </button>
    </div>
  )
}