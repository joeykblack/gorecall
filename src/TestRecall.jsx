import { Component } from 'preact'
import { useState, useCallback, useEffect, useRef } from 'preact/hooks'
import Reban from './components/Reban'

export default function TestRecall() {
  const size = 19

  const [board, setBoard] = useState(() =>
    Array.from({ length: size }, () => Array(size).fill(null))
  )
  const [moves, setMoves] = useState([]) // { x, y, sign }
  const [nextPlayerIsBlack, setNextPlayerIsBlack] = useState(() => {
    try {
      const lastProcessed = localStorage.getItem('lastProcessed')
      if (lastProcessed) {
        const { startPlayer } = JSON.parse(lastProcessed)
        return startPlayer === 1 // true if black (1), false if white (-1)
      }
    } catch (e) {}
    return true // default to black if no lastProcessed
  })

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

  const pass = useCallback(() => {
    setMoves(prev => [...prev, { x: null, y: null, sign: nextPlayerIsBlack ? 1 : -1, moveNumber: moves.length + 1 }])
    setNextPlayerIsBlack(prev => !prev)
  }, [nextPlayerIsBlack])

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
    <div className="app">
      <div className="app-content">
        <h2>Test Recall</h2>

        <div style={{ marginBottom: '0.5rem' }}>
            <button onClick={undo} disabled={moves.length === 0}>Undo</button>
            <button onClick={pass}>Pass/Tenuki</button>
        </div>


      <Reban
        signMap={board}
        markerMap={board.map(row => row.map(cell => cell?.moveNumber ? ({ type: 'label', label: cell.moveNumber.toString() }) : null))}
        showCoordinates={true}
        onVertexClick={handleVertexClick}
        maxWidth={'800px'}
      />

            <div style={{ marginTop: '1rem' }}>
            <button onClick={() => {
                localStorage.setItem('testMoves', JSON.stringify(moves))
                window.location.hash = '#/validate'
            }} disabled={moves.length === 0}>
                Validate
            </button>
            </div>
        </div>
    </div>
  )
}
