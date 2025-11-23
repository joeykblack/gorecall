import { Component, createRef } from 'preact'
import '@sabaki/shudan/css/goban.css'
import Reban from './components/Reban'
import Comments from './components/Comments'
import { processGame, processSequenceObject } from './lib/game'
import { splitFileIntoSequences } from './lib/sgf'

export default class TrainRecall extends Component {
  constructor(props) {
    super(props)

    const size = 19
    const initialSignMap = Array.from({ length: size }, () => Array(size).fill(0))

    this.state = {
      signMap: initialSignMap,
      comments: [],
      moveNumber: (() => { try { const s = localStorage.getItem('moveNumber'); return s ? parseInt(s, 10) : 0 } catch (e) { return 0 } })(),
      randomizeColor: (() => { try { return localStorage.getItem('randomizeColor') === '1' } catch (e) { return false } })(),
      startPos: (() => { try { return localStorage.getItem('startPos') || '' } catch (e) { return '' } })(),
      randomizeVariation: (() => { try { return localStorage.getItem('randomizeVariation') === '1' } catch (e) { return false } })(),
      randomizeOrientation: (() => { try { return localStorage.getItem('randomizeOrientation') === '1' } catch (e) { return false } })(),
      key: 0,
      lastSgfFile: null,
      totalMoves: 0,
      error: null,
      loading: false
    }

    this.handleFileSelect = this.handleFileSelect.bind(this)
    this.handleMoveNumberChange = this.handleMoveNumberChange.bind(this)
    this._mounted = false
    this.fileInputRef = createRef()
    this.commentsRef = createRef()
  }

  componentDidMount() {
    this._mounted = true
    this._moveNumberHandler = (e) => {
      const newNumber = Number(e?.detail)
      if (!Number.isNaN(newNumber)) {
        this.setState((state) => ({ moveNumber: newNumber, key: state.key + 1 }))
      }
    }
    window.addEventListener('moveNumberChanged', this._moveNumberHandler)

    // Run initial processing if there's stored SGF
    this.runProcessingIfNeeded()
  }

  componentWillUnmount() {
    this._mounted = false
    window.removeEventListener('moveNumberChanged', this._moveNumberHandler)
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevState.moveNumber !== this.state.moveNumber ||
      prevState.randomizeColor !== this.state.randomizeColor ||
      prevState.startPos !== this.state.startPos ||
      prevState.randomizeOrientation !== this.state.randomizeOrientation ||
      prevState.key !== this.state.key
    ) {
      this.runProcessingIfNeeded()
    }
  }

  async runProcessingIfNeeded() {
  const fileInput = this.fileInputRef?.current
  const file = fileInput?.files?.[0]
  // sequencesIndex is the catalog of stored sequences persisted earlier
  const sequencesIndexRaw = localStorage.getItem('sequencesIndex')
  const sequencesIndex = sequencesIndexRaw ? JSON.parse(sequencesIndexRaw) : []

    // Update global state used by processGame
    window.startPos = this.state.startPos
    window.randomizeVariation = this.state.randomizeVariation
    window.randomizeOrientation = this.state.randomizeOrientation

  if (!file && (!sequencesIndex || sequencesIndex.length === 0)) return

    this.setState({ loading: true })
    try {
  if (file) {
        // If a fresh file is available, prefer splitting it into sequences and
        // picking a stored sequence (this keeps memory usage low).
        try {
          const seqMeta = await splitFileIntoSequences(file)
          try { localStorage.setItem('sequencesIndex', JSON.stringify(seqMeta)) } catch (e) {}
          // pick sequence
          const pickIndex = this.state.randomizeVariation && seqMeta.length > 0 ? Math.floor(Math.random() * seqMeta.length) : 0
          const chosen = seqMeta[pickIndex]
          if (chosen) {
            await this.loadAndDisplaySequence(chosen.key)
          }
        } catch (err) {
          // fallback: try to process as a File directly
          const startPlayer = this.state.randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
          const { signMap: newSignMap, totalMoves: total, comments: moveComments } = await processGame(file, this.state.moveNumber, startPlayer)
          if (!this._mounted) return
          this.setState({ signMap: newSignMap, totalMoves: total, comments: moveComments || [] })
          try { localStorage.setItem('lastProcessed', JSON.stringify({ moveNumber: this.state.moveNumber, signMap: newSignMap, totalMoves: total, startPlayer, comments: moveComments })) } catch (e) {}
        }
      } else if (sequencesIndex && sequencesIndex.length > 0) {
        // No file in input, but we have stored sequences from earlier; pick one
        const pickIndex = this.state.randomizeVariation ? Math.floor(Math.random() * sequencesIndex.length) : 0
        const chosen = sequencesIndex[pickIndex]
        if (chosen) {
          await this.loadAndDisplaySequence(chosen.key)
        }
      } else {
        // no file and no stored sequences, fallback to reading raw SGF content if present
        // No stored raw SGF fallback anymore — nothing to do here.
        return
      }
    } catch (err) {
      if (!this._mounted) return
      this.setState({ error: err.message })
    } finally {
      if (this._mounted) this.setState({ loading: false })
    }
  }

  // Load a stored sequence from localStorage by key and display it
  async loadAndDisplaySequence(sequenceKey) {
    if (!sequenceKey) return
    try {
      const raw = localStorage.getItem(sequenceKey)
      const seqObj = raw ? JSON.parse(raw) : null
      const startPlayer = this.state.randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
      if (seqObj) {
        const { signMap: newSignMap, totalMoves: total, comments: moveComments } = await processSequenceObject(seqObj, this.state.moveNumber, startPlayer)
        if (!this._mounted) return
        this.setState({ signMap: newSignMap, totalMoves: total, comments: moveComments || [] })
        try { localStorage.setItem('lastProcessed', JSON.stringify({ moveNumber: this.state.moveNumber, sequenceKey, totalMoves: total, startPlayer, comments: moveComments })) } catch (e) {}
      }
    } catch (err) {
      console.error('Failed to load sequence:', err)
      this.setState({ error: err.message })
    }
  }

  async handleFileSelect(evt) {
    const file = evt.target.files[0]
    if (!file) return
    // When a file is selected, split it into leaf sequences and persist each
    // sequence into localStorage. Keep only a small index in localStorage
    // pointing to the stored sequence keys.
    this.setState({ loading: true, error: null })

    try {
      const seqMeta = await splitFileIntoSequences(file)

      // Persist an index of sequences so other pages can pick from it
      try { localStorage.setItem('sequencesIndex', JSON.stringify(seqMeta)) } catch (e) {}

      // Remember which file was loaded
      this.setState({ lastSgfFile: file.name })

      // Pick sequence to display: if randomizeVariation use a random sequence,
      // otherwise use the first sequence.
      const pickIndex = this.state.randomizeVariation && seqMeta.length > 0 ? Math.floor(Math.random() * seqMeta.length) : 0
      const chosen = seqMeta[pickIndex]
      if (!chosen) return

      // Load chosen sequence object from localStorage and process it
      const raw = localStorage.getItem(chosen.key)
      const seqObj = raw ? JSON.parse(raw) : null

      const startPlayer = this.state.randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
      if (seqObj) {
        const { signMap: newSignMap, totalMoves: total, comments: moveComments } = await processSequenceObject(seqObj, this.state.moveNumber, startPlayer)
        if (!this._mounted) return
        this.setState({ signMap: newSignMap, totalMoves: total, comments: moveComments || [] })
        try { localStorage.setItem('lastProcessed', JSON.stringify({ moveNumber: this.state.moveNumber, sequenceKey: chosen.key, totalMoves: total, startPlayer, comments: moveComments })) } catch (e) {}
      }

      // Do not persist the raw SGF content; sequences are stored separately.
    } catch (err) {
      this.setState({ error: err.message })
      console.error(err)
    } finally {
      this.setState({ loading: false })
    }
  }

  async handleMoveNumberChange(evt) {
    const num = parseInt(evt.target.value, 10)
    if (isNaN(num) || num < 0) return
    this.setState({ moveNumber: num })
    try { localStorage.setItem('moveNumber', num.toString()) } catch (e) {}
    // ComponentDidUpdate will call runProcessingIfNeeded which will load the
    // appropriate stored sequence (or split the current file) and update state.
  }

  render() {
    const { signMap, comments, moveNumber, randomizeVariation, randomizeColor, randomizeOrientation, startPos, lastSgfFile, totalMoves, error, loading } = this.state

    return (
      <div className="app">
        <h1 style={{ margin: '1rem 0', textAlign: 'center' }}>Go Recall</h1>
        <div className="app-content">
      <div style={{ 
          width: '100%',
          maxWidth: '800px',
          marginBottom: '1rem',
          padding: '0.5rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}>
        <details>
          <summary>About this app</summary>
          <p>This is an app for practicing visualization and recall of a Go position.</p>
          <p>It was inspired by <a href="https://www.youtube.com/watch?v=gfve7yYCS08">The Power of Visualization: How to See Moves Before They're Played | Jonas Welticke 6d</a></p>
          <p>I do not know how valuable this method of study is or if this app implements it well. You are probably better off doing tsumego.</p>
          <p>There are 2 main ways to use this app:</p>
          <ol>
            <li>Practice with variations
              <ol>
                <li>Load an SGF file with multiple variations such as <a href="http://waterfire.us/Kogo's%20Joseki%20Dictionary.sgf">Kogo's Joseki Dictionary</a></li>
                <li>Set the number of moves to a resonable number (e.g. 5)</li>
                <li>Optional: Set the variation starting position to a specific point (e.g. 3,3 to only see 3,3 joseki)</li>
                <li>Select all 3 randomization options to get maximum variety</li>
                <li>Visualize the position and then hit Test Recall</li>
                <li>Try to recall the position by placing stones on an empty board</li>
                <li>Hit Validate Recall to see how well you did</li>
                <li>Hit Next to try another variation from the same SGF</li>
              </ol>
            </li>
            <li>Practice with a single game
              <ol>
                <li>Load an SGF game such as <a href="https://homepages.cwi.nl/~aeb/go/games/games/Shusaku/#castlegames">one of the castle games</a></li>
                <li>Set the number of moves to a resonable number (e.g. 5)</li>
                <li>Disable randomization</li>
                <li>Visualize the position and then hit Test Recall</li>
                <li>Try to recall the position by placing stones on an empty board</li>
                <li>Hit Validate Recall to see how well you did</li>
                <li>Hit "Next +1 Move" to try again with one more move</li>
              </ol>
            </li>
          </ol>
          More SGF files:
          <ul>
            <li><a href="https://xmp.net/arno/fuseki.html">Arno's fuseki database</a></li>
          </ul>
        </details>
      </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label>
              Select SGF file:
              <input
                ref={this.fileInputRef}
                type="file"
                accept=".sgf"
                onChange={this.handleFileSelect}
                style={{ marginLeft: '0.5rem' }}
              />
            </label>
            {lastSgfFile && (
              <div style={{ fontSize: '0.9rem', color: '#444' }}>
                Loaded: <strong>{lastSgfFile}</strong>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ marginRight: '0.5rem' }}>
              Number of moves (0-{totalMoves || '?'}):
              <input
                type="number"
                min="0"
                max={totalMoves || 999}
                value={moveNumber}
                onChange={this.handleMoveNumberChange}
                style={{ marginLeft: '0.5rem' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ marginRight: '0.5rem' }}>
              Variations starting at:
              <select 
                value={startPos}
                onChange={(e) => {
                  const v = e.target.value
                  this.setState({ startPos: v })
                  try { localStorage.setItem('startPos', v) } catch (e) {}
                }}
                style={{ marginLeft: '0.5rem' }}
              >
                <option value="">Any</option>

                <option value="qc">3,3</option>
                <option value="qd">3,4</option>
                <option value="oc">5,3</option>
                <option value="nc">6,3</option>

                <option value="pd">4,4</option>
                <option value="od">5,4</option>
                <option value="nd">6,4</option>

                <option value="oe">5,5</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ marginLeft: '1rem' }}>
              <input
                type="checkbox"
                checked={randomizeVariation}
                onChange={(e) => {
                  const v = !!e.target.checked
                  this.setState({ randomizeVariation: v })
                  try { localStorage.setItem('randomizeVariation', v ? '1' : '0') } catch (e) {}
                }}
                style={{ marginRight: '0.5rem' }}
              />
              Randomize Variations
            </label>
            <label style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={randomizeColor}
                onChange={(e) => {
                  const v = !!e.target.checked
                  this.setState({ randomizeColor: v })
                  try { localStorage.setItem('randomizeColor', v ? '1' : '0') } catch (e) {}
                }}
                style={{ marginRight: '0.5rem' }}
              />
              Randomize Color
            </label>
            <label style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={randomizeOrientation}
                onChange={(e) => {
                  const v = !!e.target.checked
                  this.setState({ randomizeOrientation: v })
                  try { localStorage.setItem('randomizeOrientation', v ? '1' : '0') } catch (e) {}
                }}
                style={{ marginRight: '0.5rem' }}
              />
              Randomize Orientation
            </label>
          </div>

          {error && (
            <div style={{ color: 'red', marginTop: '0.5rem' }}>
              Error: {error}
            </div>
          )}
          
          {loading && (
            <div style={{ marginTop: '0.5rem' }}>
              Loading...
            </div>
          )}

          <Reban
            signMap={signMap}
            markerMap={signMap.map(row => row.map(cell => cell?.moveNumber ? { type: 'label', label: cell.moveNumber.toString() } : null))}
            showCoordinates={true}
            style={{ margin: '1rem 0' }}
          />

          <div style={{ marginBottom: '1rem' }}>
            <button onClick={() => { window.location.hash = '#/test' }}>
              Test Recall
            </button>
          </div>

          <Comments comments={comments} detailsRef={this.commentsRef} />
        </div>
      </div>
    )
  }
}
