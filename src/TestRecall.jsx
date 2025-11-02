import { Component } from 'preact'
import { useState, useCallback } from 'preact/hooks'
import '@sabaki/shudan/css/goban.css'
import { Goban } from '@sabaki/shudan'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  componentDidCatch(error) {
    this.setState({ error })
    console.error('Render error in TestRecall:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '1rem', color: 'red' }}>
          <h3>Rendering error</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error && this.state.error.stack ? this.state.error.stack : this.state.error)}</pre>
        </div>
      )
    }

    return this.props.children
  }
}

export default function TestRecall() {
  const size = 19

  const [board, setBoard] = useState(() =>
    Array.from({ length: size }, () => Array(size).fill(null))
  )
  const [moves, setMoves] = useState([]) // { x, y, sign }
  const [nextPlayerIsBlack, setNextPlayerIsBlack] = useState(true)

  const placeStone = useCallback((x, y) => {
    if (x == null || y == null) return
    // Prevent placing on occupied
    if (board[y][x]) return

    const sign = nextPlayerIsBlack ? 1 : -1
    const moveNumber = moves.length + 1

    const newBoard = board.map(row => row.slice())
    newBoard[y][x] = { sign, moveNumber }

    setBoard(newBoard)
    setMoves(prev => [...prev, { x, y, sign, moveNumber }])
    setNextPlayerIsBlack(prev => !prev)
  }, [board, moves, nextPlayerIsBlack])

  // Handler signature used by shudan: (event, position)
  const handleVertexClick = useCallback((evt, position) => {
    if (!position) return
    const [x, y] = position
    placeStone(x, y)
  }, [placeStone])

  const undo = useCallback(() => {
    if (moves.length === 0) return
    const last = moves[moves.length - 1]
    const newBoard = board.map(row => row.slice())
    newBoard[last.y][last.x] = null
    setBoard(newBoard)
    setMoves(prev => prev.slice(0, -1))
    // Switch player back
    setNextPlayerIsBlack(prev => !prev)
  }, [moves, board])

  const startWithWhite = useCallback((evt) => {
    const startWhite = !!evt.target.checked
    // Reset board when changing starting color
    setBoard(Array.from({ length: size }, () => Array(size).fill(null)))
    setMoves([])
    setNextPlayerIsBlack(!startWhite)
  }, [])

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Test Recall</h2>

      <div style={{ marginBottom: '0.5rem' }}>
        <label style={{ marginRight: '1rem' }}>
          <input type="checkbox" onChange={startWithWhite} /> Start with white
        </label>
        <button onClick={undo} disabled={moves.length === 0}>Undo</button>
      </div>

      <ErrorBoundary>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Goban
            signMap={board.map(row => row.map(cell => cell?.sign || 0))}
            markerMap={board.map(row => row.map(cell => cell?.moveNumber ? ({ type: 'label', label: cell.moveNumber.toString() }) : null))}
            vertexSize={32}
            showCoordinates={true}
            onVertexClick={handleVertexClick}
          />
        </div>
      </ErrorBoundary>

      <div style={{ marginTop: '1rem' }}>
        <strong>Moves:</strong>
        <ol>
          {moves.map((m, i) => (
            <li key={i}>{i + 1}: {m.sign === 1 ? 'B' : 'W'} @ {String.fromCharCode(97 + m.x)}{String.fromCharCode(97 + m.y)}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}
