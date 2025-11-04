import { useState, useRef, useEffect } from 'preact/hooks'
import '@sabaki/shudan/css/goban.css'
import { Goban } from '@sabaki/shudan'
import { processGame } from './lib/game'
import TestRecall from './TestRecall'
import ValidateRecall from './ValidateRecall'

// Simple error boundary to catch render-time errors and show them in the UI
import { Component } from 'preact'

export default function App() {
  const [currentHash, setCurrentHash] = useState(
    typeof window !== 'undefined' ? window.location.hash : ''
  );

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (currentHash === '#/test') {
    return <TestRecall />
  }
  if (currentHash === '#/validate') {
    return <ValidateRecall />
  }
  const [signMap, setSignMap] = useState(() => {
    const size = 19
    return Array.from({ length: size }, () => Array(size).fill(0))
  })
  
  const [comments, setComments] = useState([])
  
  const [moveNumber, setMoveNumber] = useState(() => {
    const saved = localStorage.getItem('moveNumber')
    return saved ? parseInt(saved, 10) : 0
  })

  // When checked, pick a random starting player (1 black, -1 white) for processGame
  const [randomizeColor, setRandomizeColor] = useState(() => {
    try { return localStorage.getItem('randomizeColor') === '1' } catch (e) { return false }
  })
  
  // Position selector for choosing starting position variant (qc=3,3 or qd=3,4)
  const [startPos, setStartPos] = useState(() => {
    try { return localStorage.getItem('startPos') || '' } catch (e) { return '' }
  })

  // When checked, randomly select variations instead of always taking the first one
  const [randomizeVariation, setRandomizeVariation] = useState(() => {
    try { return localStorage.getItem('randomizeVariation') === '1' } catch (e) { return false }
  })
  
  // When checked, randomly rotate and possibly transpose the board
  const [randomizeOrientation, setRandomizeOrientation] = useState(() => {
    try { return localStorage.getItem('randomizeOrientation') === '1' } catch (e) { return false }
  })

  const [key, setKey] = useState(0);
  
  // Listen for moveNumber changes from other parts of the app (same window)
  useEffect(() => {
    const handler = (e) => {
      const newNumber = Number(e?.detail)
      if (!Number.isNaN(newNumber)) {
        setMoveNumber(newNumber)
      }
      setKey(prev => prev + 1)
    }

    window.addEventListener('moveNumberChanged', handler)
    return () => window.removeEventListener('moveNumberChanged', handler)
  }, [])
  
  // Keep track of last loaded SGF filename for display
  const [lastSgfFile, setLastSgfFile] = useState(() => {
    try {
      return localStorage.getItem('lastSgfName')
    } catch (e) {
      return null
    }
  })
  const [totalMoves, setTotalMoves] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // NOTE: initial SGF processing is handled by the moveNumber effect below
  
  async function handleFileSelect(evt) {
    const file = evt.target.files[0]
    if (!file) return
    
    setLoading(true)
    setError(null)
    
    // Set global state for SGF parser to use when selecting variant
    window.startPos = startPos
    window.randomizeVariation = randomizeVariation
    window.randomizeOrientation = randomizeOrientation
    
    try {
      const startPlayer = randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
      const { signMap: newSignMap, totalMoves: total, comments: moveComments } = await processGame(file, moveNumber, startPlayer)
      setSignMap(newSignMap)
      setTotalMoves(total)
      setComments(moveComments || [])
      // Persist processed result for reuse (include startPlayer)
      try { 
        localStorage.setItem('lastProcessed', JSON.stringify({ 
          moveNumber, 
          signMap: newSignMap, 
          totalMoves: total, 
          startPlayer,
          comments: moveComments 
        })) 
      } catch (e) {}

      // Persist filename
      setLastSgfFile(file.name)
      try { localStorage.setItem('lastSgfName', file.name) } catch (e) {}

      // Read and store the SGF content
      const reader = new FileReader()
      reader.onload = (evt) => {
        const content = evt.target.result
        try { localStorage.setItem('lastSgfContent', content) } catch (e) {}
      }
      reader.readAsText(file)
    } catch (err) {
      setError(err.message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleMoveNumberChange(evt) {
    const num = parseInt(evt.target.value, 10)
    if (isNaN(num) || num < 0) return
    setMoveNumber(num)
    localStorage.setItem('moveNumber', num.toString())
    
    // If we have a file loaded (indicated by totalMoves > 0), update the position
    if (totalMoves > 0) {
      const fileInput = document.querySelector('input[type="file"]')
      const file = fileInput.files[0]
      if (file) {
        setLoading(true)
        try {
          const startPlayer = randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
          const { signMap: newSignMap, comments: moveComments } = await processGame(file, num, startPlayer)
          setSignMap(newSignMap)
          setComments(moveComments || [])
        } catch (err) {
          setError(err.message)
        } finally {
          setLoading(false)
        }
      }
    }
  }

  // When moveNumber changes (for example from ValidateRecall), re-run the SGF processing
  // so the board updates immediately. Prefer a chosen file input, otherwise use stored content.
  useEffect(() => {
    // Don't run on initial mount if there is no stored SGF
    const sgfContent = localStorage.getItem('lastSgfContent')
    const fileInput = document.querySelector('input[type="file"]')
    const file = fileInput?.files?.[0]

    // Update global state for SGF parser
    window.startPos = startPos
    window.randomizeVariation = randomizeVariation
    window.randomizeOrientation = randomizeOrientation

    if (!file && !sgfContent) return

    let mounted = true
    setLoading(true)

    const run = async () => {
      try {
        if (file) {
          const startPlayer = randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
          const { signMap: newSignMap, totalMoves: total, comments: moveComments } = await processGame(file, moveNumber, startPlayer)
          if (!mounted) return
          setSignMap(newSignMap)
          setTotalMoves(total)
          setComments(moveComments || [])
          // Persist processed result for reuse
          try { 
            localStorage.setItem('lastProcessed', JSON.stringify({ 
              moveNumber, 
              signMap: newSignMap, 
              totalMoves: total, 
              startPlayer,
              comments: moveComments 
            })) 
          } catch (e) {}
        } else {
          const blob = new Blob([sgfContent], { type: 'application/x-go-sgf' })
          const storedFile = new File([blob], 'stored.sgf', { type: 'application/x-go-sgf' })
          const startPlayer = randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
          const { signMap: newSignMap, totalMoves: total, comments: moveComments } = await processGame(storedFile, moveNumber, startPlayer)
          if (!mounted) return
          setSignMap(newSignMap)
          setTotalMoves(total)
          setComments(moveComments || [])
          // Persist processed result for reuse
          try { 
            localStorage.setItem('lastProcessed', JSON.stringify({ 
              moveNumber, 
              signMap: newSignMap, 
              totalMoves: total, 
              startPlayer,
              comments: moveComments 
            })) 
          } catch (e) {}
        }
      } catch (err) {
        if (!mounted) return
        setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    run()

    return () => { mounted = false }
  }, [moveNumber, randomizeColor, startPos, randomizeOrientation, key])

  // Responsive Goban sizing: measure available width and pick a vertexSize so the
  // full board fits comfortably on small screens. Default max vertex size is 32
  // (existing), with a sensible minimum for tiny screens.
  const boardContainerRef = useRef(null)
  const [computedVertexSize, setComputedVertexSize] = useState(32)

  useEffect(() => {
    const size = signMap.length || 19
    const maxVertex = 32
    const minVertex = 12
    const boardPadding = 16 // px padding inside the container

    function recompute() {
      const container = boardContainerRef.current
      const availableWidth = container ? container.clientWidth : window.innerWidth
      // The board width (approx) is vertexSize * (size - 1) + 2 * boardPadding
      // Solve for vertexSize and clamp
      const tentative = Math.floor((availableWidth - 2 * boardPadding) / (Math.max(1, size + 1)))
      const vertex = Math.max(minVertex, Math.min(maxVertex, tentative))
      setComputedVertexSize(vertex)
    }

    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('orientationchange', recompute)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('orientationchange', recompute)
    }
  }, [signMap])

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
            </details>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label>
            Select SGF file:
            <input
              type="file"
              accept=".sgf"
              onChange={handleFileSelect}
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
              onChange={handleMoveNumberChange}
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
                setStartPos(v)
                localStorage.setItem('startPos', v)
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
                setRandomizeVariation(v)
                localStorage.setItem('randomizeVariation', v ? '1' : '0')
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
                setRandomizeColor(v)
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
                setRandomizeOrientation(v)
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
        <div ref={boardContainerRef}>
          <Goban
            signMap={signMap.map(row => row.map(cell => cell?.sign || 0))}
            vertexSize={computedVertexSize}
            showCoordinates={true}
            markerMap={signMap.map(row => 
              row.map(cell => cell?.moveNumber ? 
                { type: 'label', label: cell.moveNumber.toString() } : 
                null
              )
            )}
            style={{ margin: '1rem 0'}}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <button onClick={() => {
            // Navigate to test recall route in same tab
            window.location.hash = '#/test'
          }}>
            Test Recall
          </button>
        </div>

        {comments.length > 0 && (
          <div style={{ 
            width: '100%',
            maxWidth: '800px',
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px'
          }}>
            <details>
                <summary><strong>Comments:</strong></summary>
                <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                {comments.map((comment, i) => (
                    <li key={i}>
                    <pre style={{ 
                        margin: '0.25rem 0',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        fontFamily: 'inherit',
                        fontSize: 'inherit'
                    }}>
                        {comment}
                    </pre>
                    </li>
                ))}
                </ol>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
