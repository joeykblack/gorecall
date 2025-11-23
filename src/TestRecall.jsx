import { Component } from 'preact'
import Reban from './components/Reban'
import Comments from './components/Comments'

export default class TestRecall extends Component {
  constructor(props) {
    super(props)
    const size = 19
    this.state = {
      board: Array.from({ length: size }, () => Array(size).fill(null)),
      moves: [],
      comments: [],
      nextPlayerIsBlack: (() => {
        try {
          const lastProcessed = localStorage.getItem('lastProcessed')
          if (lastProcessed) {
            const { startPlayer } = JSON.parse(lastProcessed)
            return startPlayer === 1
          }
        } catch (e) {}
        return true
      })()
    }

    this.placeStone = this.placeStone.bind(this)
    this.handleVertexClick = this.handleVertexClick.bind(this)
    this.pass = this.pass.bind(this)
    this.undo = this.undo.bind(this)
    this.startWithWhite = this.startWithWhite.bind(this)
    this.commentsRef = null
  }

  componentDidMount() {
    // load comments from lastProcessed if present
    try {
      const lastProcessedRaw = localStorage.getItem('lastProcessed')
      if (lastProcessedRaw) {
        const parsed = JSON.parse(lastProcessedRaw)
        if (parsed && parsed.comments) this.setState({ comments: parsed.comments })
      }
    } catch (e) {}
  }

  placeStone(x, y) {
    if (x == null || y == null) return
    const { board, moves, nextPlayerIsBlack } = this.state
    if (board[y][x]) return

    const sign = nextPlayerIsBlack ? 1 : -1
    const moveNumber = moves.length + 1
    const newBoard = board.map(row => row.slice())
    newBoard[y][x] = { sign, moveNumber }

    this.setState((state) => ({
      board: newBoard,
      moves: [...state.moves, { x, y, sign, moveNumber }],
      nextPlayerIsBlack: !state.nextPlayerIsBlack
    }))
  }

  handleVertexClick(evt, position) {
    if (!position) return
    const [x, y] = position
    this.placeStone(x, y)
  }

  pass() {
    this.setState((state) => ({
      moves: [...state.moves, { x: null, y: null, sign: state.nextPlayerIsBlack ? 1 : -1, moveNumber: state.moves.length + 1 }],
      nextPlayerIsBlack: !state.nextPlayerIsBlack
    }))
  }

  undo() {
    const { moves, board } = this.state
    if (moves.length === 0) return
    const last = moves[moves.length - 1]
    const newBoard = board.map(row => row.slice())
    if (Number.isInteger(last.x) && Number.isInteger(last.y)) newBoard[last.y][last.x] = null
    this.setState((state) => ({
      board: newBoard,
      moves: state.moves.slice(0, -1),
      nextPlayerIsBlack: !state.nextPlayerIsBlack
    }))
  }

  startWithWhite(evt) {
    const startWhite = !!evt.target.checked
    const size = 19
    this.setState({
      board: Array.from({ length: size }, () => Array(size).fill(null)),
      moves: [],
      nextPlayerIsBlack: !startWhite
    })
  }

  render() {
    const { board, moves } = this.state
    return (
      <div className="app">
        <div className="app-content">
          <h2>Test Recall</h2>

          <div style={{ marginBottom: '0.5rem' }}>
              <button onClick={this.undo} disabled={moves.length === 0}>Undo</button>
              <button onClick={this.pass}>Pass/Tenuki</button>
          </div>


        <Reban
          signMap={board}
          markerMap={board.map(row => row.map(cell => cell?.moveNumber ? ({ type: 'label', label: cell.moveNumber.toString() }) : null))}
          showCoordinates={true}
          onVertexClick={this.handleVertexClick}
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
              
          <Comments comments={this.state.comments} detailsRef={this.commentsRef} />
          </div>
      </div>
    )
  }
}
