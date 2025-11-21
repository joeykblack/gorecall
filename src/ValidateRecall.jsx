import { Component } from 'preact'
import '@sabaki/shudan/css/goban.css'
import Reban from './components/Reban'
import { processGame } from './lib/game'

export default class ValidateRecall extends Component {
  constructor(props) {
    super(props)
    const emptyBoard = Array.from({ length: 19 }, () => Array(19).fill(null))
    this.state = {
      testMoves: [],
      sgfMoves: [],
      error: null,
      loading: true,
      validationMessage: '',
      sgfBoard: emptyBoard,
      testBoard: emptyBoard,
      moveNumber: (() => { const saved = localStorage.getItem('moveNumber'); return saved ? parseInt(saved, 10) : 0 })()
    }

    this.loadTestMoves = this.loadTestMoves.bind(this)
    this.loadSGF = this.loadSGF.bind(this)
    this.validate = this.validate.bind(this)
    this.onNextPlusOne = this.onNextPlusOne.bind(this)
  }

  componentDidMount() {
    this.loadTestMoves()
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.testMoves !== this.state.testMoves) {
      this.loadSGF()
    }
  }

  loadTestMoves() {
    const savedTestMoves = localStorage.getItem('testMoves')
    if (savedTestMoves) {
      const moves = JSON.parse(savedTestMoves)
      // Reconstruct test board from moves. Skip pass moves (no x/y).
      const board = Array.from({ length: 19 }, () => Array(19).fill(0))
      moves.forEach(move => {
        if (Number.isInteger(move.x) && Number.isInteger(move.y) && move.x >= 0 && move.x < 19 && move.y >= 0 && move.y < 19) {
          board[move.y][move.x] = { sign: move.sign, moveNumber: move.moveNumber }
        }
      })
      this.setState({ testMoves: moves, testBoard: board })
    } else {
      this.setState({ loading: false })
    }
  }

  async loadSGF() {
    this.setState({ loading: true })
    try {
      const lastProcessedRaw = localStorage.getItem('lastProcessed')
      if (lastProcessedRaw) {
        const parsed = JSON.parse(lastProcessedRaw)
        if (parsed && parsed.moveNumber === this.state.moveNumber && parsed.signMap) {
          this.setState((state) => ({
            sgfBoard: parsed.signMap,
            sgfMoves: [...state.sgfMoves, { signMap: parsed.signMap, totalMoves: parsed.totalMoves }]
          }))
          this.validate(this.state.testMoves, parsed.signMap, parsed.totalMoves)
          this.setState({ loading: false })
          return
        }
      }
    } catch (err) {
      this.setState({ error: err.message })
    } finally {
      this.setState({ loading: false })
    }
  }

  validate(testMoves, sgfBoard, totalSgfMoves) {
    if (!testMoves || testMoves.length === 0) {
      this.setState({ validationMessage: 'No moves to validate' })
      return
    }

    const mismatches = testMoves.map(move => {
      if (!Number.isInteger(move.x) || !Number.isInteger(move.y)) {
        let found = false
        for (let r = 0; r < sgfBoard.length && !found; r++) {
          for (let c = 0; c < sgfBoard[r].length; c++) {
            const cell = sgfBoard[r][c]
            if (cell && cell.moveNumber === move.moveNumber) { found = true; break }
          }
        }
        if (found) return { moveNumber: move.moveNumber }
        return null
      }

      if (move.y < 0 || move.y >= sgfBoard.length || move.x < 0 || move.x >= sgfBoard[0].length) {
        return { moveNumber: move.moveNumber }
      }

      const sgfCell = sgfBoard[move.y][move.x]
      const sgfSign = sgfCell?.sign || 0
      if (sgfSign !== move.sign || move.moveNumber !== sgfCell?.moveNumber) return { moveNumber: move.moveNumber }
      return null
    }).filter(Boolean)

    if (mismatches.length === 0 && totalSgfMoves === testMoves.length) {
      this.setState({ validationMessage: 'All moves match! 🎉' })
    } else {
      const mismatchList = mismatches.map(m => `Move ${m.moveNumber}`).join('\n')
      this.setState({ validationMessage: `Found ${mismatches.length} incorrect moves:\n${mismatchList}` })
    }
  }

  onNextPlusOne() {
    const newNumber = (this.state.moveNumber || 0) + 1
    this.setState({ moveNumber: newNumber })
    try { localStorage.setItem('moveNumber', newNumber.toString()) } catch (e) {}
    window.dispatchEvent(new CustomEvent('moveNumberChanged', { detail: newNumber }))
    window.location.hash = null
  }

  render() {
    const { error, loading, validationMessage, sgfBoard, testBoard, moveNumber } = this.state

    if (error) {
      return (
        <div style={{ padding: '1rem', color: 'red' }}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => history.back()}>Go Back</button>
        </div>
      )
    }

    if (loading) return <div style={{ padding: '1rem' }}>Loading...</div>

    return (
      <div className="app">
        <div className="app-content">
          <h2>Validate Recall</h2>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <h3>Your Moves</h3>
              <Reban
                signMap={testBoard}
                markerMap={testBoard.map(row => row.map(cell => cell?.moveNumber ? ({ type: 'label', label: cell.moveNumber.toString() }) : null))}
                showCoordinates={true}
              />
            </div>

            <div>
              <h3>SGF Moves</h3>
              <Reban
                signMap={sgfBoard}
                markerMap={sgfBoard.map(row => row.map(cell => cell?.moveNumber ? ({ type: 'label', label: cell.moveNumber.toString() }) : null))}
                showCoordinates={true}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: validationMessage.includes('match') ? '#e6ffe6' : '#ffe6e6', borderRadius: '4px', whiteSpace: 'pre-line' }}>
            <strong>Result:</strong>
            <p>{validationMessage}</p>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <button onClick={() => history.back()}>Try Again</button>
            <button onClick={() => { window.location.hash = null }}>Restart</button>
            <button onClick={() => { window.dispatchEvent(new CustomEvent('moveNumberChanged', { detail: moveNumber })); window.location.hash = null }}>Next</button>
            <button onClick={this.onNextPlusOne}>Next +1 Move</button>
          </div>
        </div>
      </div>
    )
  }
}