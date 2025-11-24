import { Component, createRef } from 'preact'
import '@sabaki/shudan/css/goban.css'
import Reban from './components/Reban'
import Comments from './components/Comments'
import TagSelector from './components/TagSelector'
import { splitFileIntoSequences } from './lib/sgf'
import { processSequenceObject } from './lib/game'
import { getSequence } from './lib/seqDB'

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
      // variationMode: 'fixed' | 'random' | 'sequential'
      variationMode: (() => {
        try {
          const vm = localStorage.getItem('variationMode')
          if (vm) return vm
          // backward-compat: if old boolean key exists, map it
          const rv = localStorage.getItem('randomizeVariation')
          return rv === '1' ? 'random' : 'fixed'
        } catch (e) {
          return 'fixed'
        }
      })(),
      randomizeOrientation: (() => { try { return localStorage.getItem('randomizeOrientation') === '1' } catch (e) { return false } })(),
      key: 0,
      lastSgfFile: null,
      totalMoves: 0,
      error: null,
      loading: false
      ,
      sequencesIndex: [],
      filteredIndices: [],
      // Selected tags for filtering sequences (e.g. ['joseki'])
      selectedTags: (() => { try { const s = localStorage.getItem('selectedTags'); return s ? JSON.parse(s) : [] } catch (e) { return [] } })()
    }

    // Variation index persisted for non-random selection
    try {
      const vi = localStorage.getItem('variationIndex')
      this.state.variationIndex = vi ? parseInt(vi, 10) : 0
    } catch (e) {
      this.state.variationIndex = 0
    }

    // Color choice persisted: 'black' or 'white'
    try {
      const cc = localStorage.getItem('colorChoice')
      this.state.colorChoice = cc === 'white' ? 'white' : 'black'
    } catch (e) {
      this.state.colorChoice = 'black'
    }

    this.handleFileSelect = this.handleFileSelect.bind(this)
    this.handleMoveNumberChange = this.handleMoveNumberChange.bind(this)
    this.generateSequence = this.generateSequence.bind(this)
    this.pickVariationIndex = this.pickVariationIndex.bind(this)
    this.determineStartPlayer = this.determineStartPlayer.bind(this)
    this.decreaseMoveNumber = this.decreaseMoveNumber.bind(this)
    this.increaseMoveNumber = this.increaseMoveNumber.bind(this)
    this.decreaseVariationIndex = this.decreaseVariationIndex.bind(this)
    this.increaseVariationIndex = this.increaseVariationIndex.bind(this)
    this._mounted = false
    this.fileInputRef = createRef()
    this.commentsRef = createRef()
  }

  decreaseMoveNumber() {
    this.setState((state) => {
      const cur = Number(state.moveNumber) || 0
      let next = Math.max(0, cur - 1)
      if (state.totalMoves && next > state.totalMoves) next = state.totalMoves
      try { localStorage.setItem('moveNumber', next.toString()) } catch (e) { }
      return { moveNumber: next }
    })
  }

  increaseMoveNumber() {
    this.setState((state) => {
      const cur = Number(state.moveNumber) || 0
      let next = cur + 1
      if (state.totalMoves && next > state.totalMoves) next = state.totalMoves
      try { localStorage.setItem('moveNumber', next.toString()) } catch (e) { }
      return { moveNumber: next }
    })
  }

  decreaseVariationIndex() {
    this.setState((state) => {
      const cur = Number(state.variationIndex) || 0
      let next = Math.max(0, cur - 1)
      // clamp to available filtered length if present
      const filtered = Array.isArray(state.filteredIndices) && state.filteredIndices.length > 0 ? state.filteredIndices : (Array.isArray(state.sequencesIndex) ? state.sequencesIndex.map((_, i) => i) : [])
      const max = Math.max(0, filtered.length - 1)
      if (next > max) next = max
      try { localStorage.setItem('variationIndex', next.toString()) } catch (e) { }
      return { variationIndex: next }
    })
  }

  increaseVariationIndex() {
    this.setState((state) => {
      const cur = Number(state.variationIndex) || 0
      const filtered = Array.isArray(state.filteredIndices) && state.filteredIndices.length > 0 ? state.filteredIndices : (Array.isArray(state.sequencesIndex) ? state.sequencesIndex.map((_, i) => i) : [])
      const max = Math.max(0, filtered.length - 1)
      let next = cur + 1
      if (next > max) next = max
      try { localStorage.setItem('variationIndex', next.toString()) } catch (e) { }
      return { variationIndex: next }
    })
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

    // Load any previously-saved sequences index from localStorage into state
    try {
      const raw = localStorage.getItem('sequencesIndex')
      const idx = raw ? JSON.parse(raw) : []
      if (idx && idx.length > 0) {
        // Initialize filteredIndices based on current startPos
        const startPos = this.state.startPos || ''
        const filtered = this.filterIndices(startPos, idx)
        // Set sequencesIndex, then compute filteredIndices and generate a
        // sequence after filteredIndices has been updated.
        this.setState({ sequencesIndex: idx }, () => {
          this.filterIndices(startPos, idx, () => {
            try {
              this.generateSequence()
            } catch (e) {
              // ignore
            }
          })
        })
      }
    } catch (e) {
      // ignore parse errors
    }

    // Restore last selected filename for UI if present
    try {
      const last = localStorage.getItem('lastSgfFile')
      if (last) this.setState({ lastSgfFile: last })
    } catch (e) {
      // ignore
    }

    // Ensure tags-based filtering runs when we have an index already in
    // localStorage (this covers the case where selectedTags were restored in
    // the constructor). If sequencesIndex was already set above we'll have
    // run filterIndices; otherwise nothing to do here.

  }

  componentWillUnmount() {
    this._mounted = false
    window.removeEventListener('moveNumberChanged', this._moveNumberHandler)
  }

  componentDidUpdate(prevProps, prevState) {

  }

  // Compute filtered indices for the given startPos from a sequences array.
  // Returns an array of indices (possibly empty). If no startPos is
  // provided, returns all indices. If startPos filters to nothing, returns
  // all indices (so the UI still has something to pick from).
  // Compute filtered indices for the given startPos from a sequences array.
  // Also updates component state.filteredIndices. If a callback is provided
  // it will be invoked after state update completes.
  filterIndices(startPos, sequences, cb) {
    const seq = Array.isArray(sequences) ? sequences : (Array.isArray(this.state.sequencesIndex) ? this.state.sequencesIndex : [])
    if (!seq || seq.length === 0) {
      try { this.setState({ filteredIndices: [] }, cb) } catch (e) { if (cb) cb() }
      return []
    }
    const sp = startPos || ''
    let filtered
    if (!sp) filtered = seq.map((_, i) => i)
    else {
      const matches = []
      for (let i = 0; i < seq.length; i++) {
        const item = seq[i]
        if (item && item.firstMove === sp) matches.push(i)
      }
      filtered = matches.length > 0 ? matches : seq.map((_, i) => i)
    }
    // Further filter by selected tags (all selected tags must be present
    // on the sequence's `tags` array). Read selectedTags from state.
    const tags = Array.isArray(this.state.selectedTags) ? this.state.selectedTags : []
    let final = filtered
    if (tags && tags.length > 0) {
      const matches = []
      for (let i = 0; i < filtered.length; i++) {
        const idx = filtered[i]
        const item = seq[idx]
        const itemTags = Array.isArray(item && item.tags) ? item.tags : []
        // check that itemTags contains all tags
        let ok = true
        for (let t = 0; t < tags.length; t++) {
          if (itemTags.indexOf(tags[t]) === -1) { ok = false; break }
        }
        if (ok) matches.push(idx)
      }
      final = matches.length > 0 ? matches : []
    }

    try {
      this.setState({ filteredIndices: final }, cb)
    } catch (e) {
      if (cb) cb()
    }
    return final
  }

  // Pick a variation index from the available sequences. Modes:
  // - 'fixed': use persisted variationIndex (clamped)
  // - 'random': pick random position from filtered list and persist position
  // - 'sequential': return current variationIndex position then increment it
  //                 (persisting the next position for the following call)
  pickVariationIndex(sequencesIndex) {
    const sequences = this.state.sequencesIndex || []
    if (!sequences || sequences.length === 0) return 0

  // Compute and update filteredIndices (filterIndicesByStartPos will set state)
  const filtered = this.filterIndices(this.state.startPos || '', sequences)

    const mode = this.state.variationMode || 'fixed'
    if (mode === 'random') {
      const pos = Math.floor(Math.random() * filtered.length)
      try { this.setState({ variationIndex: pos }) } catch (e) { }
      try { localStorage.setItem('variationIndex', pos.toString()) } catch (e) { }
      // return the original index into sequencesIndex
      return filtered[pos]
    }

    if (mode === 'sequential') {
      let vi = Number(this.state.variationIndex)
      if (isNaN(vi) || vi < 0) vi = 0
      if (filtered.length === 0) return 0
      // current selection is modulo filtered length
      const currentPos = vi % filtered.length
      // persist next position for subsequent calls
      const next = (currentPos + 1) % filtered.length
      try { this.setState({ variationIndex: next }) } catch (e) { }
      try { localStorage.setItem('variationIndex', next.toString()) } catch (e) { }
      return filtered[currentPos]
    }

    // 'fixed' mode (default): treat variationIndex as an index into filtered
    let vi = Number(this.state.variationIndex)
    if (isNaN(vi) || vi < 0) vi = 0
    if (vi >= filtered.length) vi = filtered.length - 1
    try { localStorage.setItem('variationIndex', vi.toString()) } catch (e) { }
    return filtered[vi]
  }

  // Determine starting player: if randomizeColor is enabled pick randomly
  // (persisting the picked color); otherwise use the persisted/selected
  // `colorChoice` value.
  determineStartPlayer() {
    if (this.state.randomizeColor) {
      const pick = Math.random() < 0.5 ? 'black' : 'white'
      try {
        this.setState({ colorChoice: pick })
      } catch (e) { }
      try { localStorage.setItem('colorChoice', pick) } catch (e) { }
      return pick === 'black' ? 1 : -1
    }
    const choice = this.state.colorChoice || 'black'
    return choice === 'black' ? 1 : -1
  }

  // Load a stored sequence from localStorage by key and display it
  async loadAndDisplaySequence(sequenceKey, startPlayer) {
    if (!sequenceKey) return
    try {
      const seqObj = await getSequence(sequenceKey)
      if (seqObj) {
        const { signMap: newSignMap, totalMoves: total, comments: moveComments } = await processSequenceObject(seqObj, this.state.moveNumber, startPlayer, this.state.selectedTags, this.state.randomizeOrientation)
        if (!this._mounted) return
        this.setState({ signMap: newSignMap, totalMoves: total, comments: moveComments || [] })
        try { localStorage.setItem('lastProcessed', JSON.stringify({ moveNumber: this.state.moveNumber, sequenceKey, totalMoves: total, signMap: newSignMap, startPlayer, comments: moveComments })) } catch (e) { }
      }
    } catch (err) {
      console.error('Failed to load sequence:', err)
      this.setState({ error: err.message })
    }
  }

  // Trigger picking and loading a sequence from the saved sequences index.
  async generateSequence() {
    const sequencesIndex = this.state.sequencesIndex || []
    if (!sequencesIndex || sequencesIndex.length === 0) return

    this.setState({ loading: true, error: null })
    try {
      const pickIndex = this.pickVariationIndex()
      const startPlayer = this.determineStartPlayer()
      const chosen = sequencesIndex[pickIndex]
      if (chosen) await this.loadAndDisplaySequence(chosen.key, startPlayer)
    } catch (err) {
      console.error('generateSequence error', err)
      this.setState({ error: err.message })
    } finally {
      this.setState({ loading: false })
    }
  }

  // (runProcessingIfNeeded will be invoked from handleFileSelect when a
  // file is chosen — no global invocation here.)

  async handleFileSelect(evt) {
    const file = evt.target.files[0]
    if (!file) return
    // When a file is selected, split it into leaf sequences and persist each
    // sequence into localStorage. Keep only a small index in localStorage
    // pointing to the stored sequence keys.
    this.setState({ loading: true, error: null })

    try {
      const seqMeta = await splitFileIntoSequences(file)

      // Persist an index of sequences so Generate can use it
      try { localStorage.setItem('sequencesIndex', JSON.stringify(seqMeta)) } catch (e) { }

      // Remember which file was loaded (UI only) and cache the index in state
      // so UI doesn't need to read localStorage synchronously.
      const sequencesIndex = seqMeta || []
      const startPos = this.state.startPos || ''

      // Clear any selected tags when a new file is chosen so filters don't
      // accidentally persist across different datasets. Persist the cleared
      // selection to localStorage and recompute filteredIndices after state
      // has been updated.
      try { localStorage.setItem('selectedTags', JSON.stringify([])) } catch (e) { }
      try { localStorage.setItem('lastSgfFile', file.name) } catch (e) { }
      this.setState({ lastSgfFile: file.name, sequencesIndex, selectedTags: [] }, () => {
        // Recompute filteredIndices now that sequencesIndex and selectedTags
        // are in state.
        try {
          this.filterIndices(startPos, sequencesIndex)
        } catch (e) {
          // ignore
        }
      })

      // Do NOT auto-load any sequence here. The user must click Generate to
      // display a sequence. This keeps behavior explicit and avoids
      // unintended loads when toggling options.
      // Still run any file-based processing centrally via runProcessingIfNeeded
      // so behaviour that belongs to file selection can run in one place.
      // await this.runProcessingIfNeeded()
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
    try { localStorage.setItem('moveNumber', num.toString()) } catch (e) { }
    // ComponentDidUpdate will call runProcessingIfNeeded which will load the
    // appropriate stored sequence (or split the current file) and update state.
  }

  render() {
    const { signMap, comments, moveNumber, variationMode, randomizeColor, randomizeOrientation, startPos, lastSgfFile, totalMoves, error, loading } = this.state

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

          <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ marginRight: '0.5rem' }}>Number of moves (0-{totalMoves || '?'}):</div>
            <button
              onClick={this.decreaseMoveNumber}
              aria-label="Decrease moves"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              −
            </button>
            <input
              type="number"
              min="0"
              max={totalMoves || 999}
              value={moveNumber}
              onChange={this.handleMoveNumberChange}
              style={{ width: '5rem', textAlign: 'center' }}
            />
            <button
              onClick={this.increaseMoveNumber}
              aria-label="Increase moves"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              +
            </button>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ marginRight: '0.5rem' }}>
              Variations starting at:
              <select
                value={startPos}
                onChange={(e) => {
                  const v = e.target.value
                  // update startPos and recompute filteredIndices immediately
                  this.setState({ startPos: v }, () => {
                    try { localStorage.setItem('startPos', v) } catch (e) { }
                    // recompute filteredIndices based on new startPos
                    const sequences = this.state.sequencesIndex || []
                    if (sequences && sequences.length > 0) {
                      this.filterIndices(v, sequences)
                    }
                  })
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
            {/* Tag selector (chip-style) */}
            <label style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              With tag:
              {/* Build unique tag options from sequencesIndex so the selector is dynamic */}
              {
                (() => {
                  const sequences = this.state.sequencesIndex || []
                  const uniq = []
                  for (let i = 0; i < sequences.length; i++) {
                    const t = sequences[i] && sequences[i].tags
                    if (Array.isArray(t)) {
                      for (let j = 0; j < t.length; j++) {
                        const val = t[j]
                        if (uniq.indexOf(val) === -1) uniq.push(val)
                      }
                    }
                  }
                  return (
                    <TagSelector
                      options={uniq}
                      selected={this.state.selectedTags}
                      onChange={(opts) => {
                        this.setState({ selectedTags: opts }, () => {
                          try { localStorage.setItem('selectedTags', JSON.stringify(opts)) } catch (err) { }
                          const sequences = this.state.sequencesIndex || []
                          if (sequences && sequences.length > 0) this.filterIndices(this.state.startPos || '', sequences)
                        })
                      }}
                      style={{ marginLeft: '0.5rem' }}
                    />
                  )
                })()
              }
            </label>
          </div>

          {/* Randomize Variations on its own line with a variation index input */}
          <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ marginRight: '0.5rem' }}>Variation mode:</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="radio"
                  name="variationMode"
                  value="fixed"
                  checked={this.state.variationMode === 'fixed'}
                  onChange={() => {
                    try { this.setState({ variationMode: 'fixed' }) } catch (e) { }
                    try { localStorage.setItem('variationMode', 'fixed') } catch (e) { }
                  }}
                />
                Fixed
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="radio"
                  name="variationMode"
                  value="random"
                  checked={this.state.variationMode === 'random'}
                  onChange={() => {
                    try { this.setState({ variationMode: 'random' }) } catch (e) { }
                    try { localStorage.setItem('variationMode', 'random') } catch (e) { }
                  }}
                />
                Random
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="radio"
                  name="variationMode"
                  value="sequential"
                  checked={this.state.variationMode === 'sequential'}
                  onChange={() => {
                    try { this.setState({ variationMode: 'sequential' }) } catch (e) { }
                    try { localStorage.setItem('variationMode', 'sequential') } catch (e) { }
                  }}
                />
                Sequential
              </label>
            </div>

            {/* Variation index input (shows current variation number) with +/- buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                onClick={this.decreaseVariationIndex}
                aria-label="Decrease variation"
                style={{ padding: '0.25rem 0.5rem' }}
              >
                −
              </button>
              <input
                type="number"
                min={0}
                value={this.state.variationIndex}
                onChange={(e) => {
                  let v = parseInt(e.target.value, 10)
                  if (Number.isNaN(v)) v = 0
                  this.setState({ variationIndex: v })
                  try { localStorage.setItem('variationIndex', v.toString()) } catch (err) { }
                }}
                style={{ width: '5rem', textAlign: 'center' }}
              />
              <button
                onClick={this.increaseVariationIndex}
                aria-label="Increase variation"
                style={{ padding: '0.25rem 0.5rem' }}
              >
                +
              </button>
            </div>

            {/* Available variations count (based on filteredIndices) */}
            <div style={{ marginLeft: '0.5rem', color: '#444' }}>
              {typeof this.state.filteredIndices === 'object' ? this.state.filteredIndices.length : '?'} variations
            </div>
          </div>

          {/* Randomize Color on its own line with radio select */}
          <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={randomizeColor}
                onChange={(e) => {
                  const v = !!e.target.checked
                  this.setState({ randomizeColor: v })
                  try { localStorage.setItem('randomizeColor', v ? '1' : '0') } catch (e) { }
                }}
                style={{ marginRight: '0.5rem' }}
              />
              Randomize Color
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="radio"
                  name="colorChoice"
                  value="black"
                  checked={this.state.colorChoice === 'black'}
                  onChange={(e) => {
                    this.setState({ colorChoice: 'black' })
                    try { localStorage.setItem('colorChoice', 'black') } catch (err) { }
                  }}
                />
                Black
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="radio"
                  name="colorChoice"
                  value="white"
                  checked={this.state.colorChoice === 'white'}
                  onChange={(e) => {
                    this.setState({ colorChoice: 'white' })
                    try { localStorage.setItem('colorChoice', 'white') } catch (err) { }
                  }}
                />
                White
              </label>
            </div>
          </div>

          {/* Randomize Orientation on the next line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={randomizeOrientation}
                onChange={(e) => {
                  const v = !!e.target.checked
                  this.setState({ randomizeOrientation: v })
                  try { localStorage.setItem('randomizeOrientation', v ? '1' : '0') } catch (e) { }
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

          {/* Generate button placed immediately above the board */}
          <div style={{ marginBottom: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={this.generateSequence} disabled={!(this.state.filteredIndices && this.state.filteredIndices.length > 0)}>
              Generate
            </button>
          </div>

          <Reban
            signMap={signMap}
            markerMap={signMap.map(row => row.map(cell => cell?.moveNumber ? { type: 'label', label: cell.moveNumber.toString() } : null))}
            showCoordinates={true}
            style={{ margin: '1rem 0' }}
          />

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { window.location.hash = '#/test' }}>
                Test Recall
              </button>
            </div>
          </div>

          <Comments comments={comments} detailsRef={this.commentsRef} />
        </div>
      </div>
    )
  }
}
