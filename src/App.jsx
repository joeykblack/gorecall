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
  
  // Listen for moveNumber changes from other parts of the app (same window)
  useEffect(() => {
    const handler = (e) => {
      const newNumber = Number(e?.detail)
      if (!Number.isNaN(newNumber)) {
        setMoveNumber(newNumber)
      }
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
    
    try {
      const startPlayer = randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
      const { signMap: newSignMap, totalMoves: total } = await processGame(file, moveNumber, startPlayer)
      setSignMap(newSignMap)
      setTotalMoves(total)
      // Persist processed result for reuse (include startPlayer)
      try { localStorage.setItem('lastProcessed', JSON.stringify({ moveNumber, signMap: newSignMap, totalMoves: total, startPlayer })) } catch (e) {}

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
          const { signMap: newSignMap } = await processGame(file, num, startPlayer)
          setSignMap(newSignMap)
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

    if (!file && !sgfContent) return

    let mounted = true
    setLoading(true)

    const run = async () => {
      try {
        if (file) {
          const startPlayer = randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
          const { signMap: newSignMap, totalMoves: total } = await processGame(file, moveNumber, startPlayer)
          if (!mounted) return
          setSignMap(newSignMap)
          setTotalMoves(total)
          // Persist processed result for reuse
          try { localStorage.setItem('lastProcessed', JSON.stringify({ moveNumber, signMap: newSignMap, totalMoves: total, startPlayer })) } catch (e) {}
        } else {
          const blob = new Blob([sgfContent], { type: 'application/x-go-sgf' })
          const storedFile = new File([blob], 'stored.sgf', { type: 'application/x-go-sgf' })
          const startPlayer = randomizeColor ? (Math.random() < 0.5 ? 1 : -1) : 1
          const { signMap: newSignMap, totalMoves: total } = await processGame(storedFile, moveNumber, startPlayer)
          if (!mounted) return
          setSignMap(newSignMap)
          setTotalMoves(total)
          // Persist processed result for reuse
          try { localStorage.setItem('lastProcessed', JSON.stringify({ moveNumber, signMap: newSignMap, totalMoves: total, startPlayer })) } catch (e) {}
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
  }, [moveNumber, randomizeColor])

  return (
    <div className="app">
      <h1>Go Recall</h1>
      
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ marginRight: '0.5rem' }}>
            Move number (0-{totalMoves || '?'}):
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
            Starting Position:
            <select 
              value={startPos}
              onChange={(e) => {
                const v = e.target.value
                setStartPos(v)
                localStorage.setItem('startPos', v)
                // If we have a file loaded, reprocess it with the new position
                const fileInput = document.querySelector('input[type="file"]')
                if (fileInput?.files?.[0]) {
                  window.startPos = v
                  handleFileSelect({ target: fileInput })
                }
              }}
              style={{ marginLeft: '0.5rem' }}
            >
              <option value="">Default</option>
              <option value="qc">3,3</option>
              <option value="qd">3,4</option>
            </select>
          </label>
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
      </div>

        <Goban
          signMap={signMap.map(row => row.map(cell => cell?.sign || 0))}
          vertexSize={32}
          showCoordinates={true}
          markerMap={signMap.map(row => 
            row.map(cell => cell?.moveNumber ? 
              { type: 'label', label: cell.moveNumber.toString() } : 
              null
            )
          )}
        />

      <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
        <button onClick={() => {
          // Navigate to test recall route in same tab
          window.location.hash = '#/test'
        }}>
          Test Recall
        </button>
      </div>
    </div>
  )
}
