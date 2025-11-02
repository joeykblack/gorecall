import { useState, useRef, useEffect } from 'preact/hooks'
import '@sabaki/shudan/css/goban.css'
import { Goban } from '@sabaki/shudan'
import { processGame } from './lib/game'
import TestRecall from './TestRecall'
import ValidateRecall from './ValidateRecall'

// Simple error boundary to catch render-time errors and show them in the UI
import { Component } from 'preact'

export default function App() {
  //   If the app was opened with the '#/test' hash, render the TestRecall page
  if (typeof window !== 'undefined' && window.location.hash === '#/test') {
    return <TestRecall />
  }
  if (typeof window !== 'undefined' && window.location.hash === '#/validate') {
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
  
  // Keep track of last loaded SGF for validation
  const [lastSgfFile, setLastSgfFile] = useState(null)
  const [totalMoves, setTotalMoves] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // On mount, if we have SGF content in localStorage, load it
  useEffect(() => {
    const sgfContent = localStorage.getItem('lastSgfContent')
    if (!sgfContent) return

    setLoading(true)
    const blob = new Blob([sgfContent], { type: 'application/x-go-sgf' })
    const file = new File([blob], 'stored.sgf', { type: 'application/x-go-sgf' })

    processGame(file, moveNumber)
      .then(({ signMap: newSignMap, totalMoves: total }) => {
        setSignMap(newSignMap)
        setTotalMoves(total)
      })
      .catch(err => {
        setError(err.message)
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [])
  
  async function handleFileSelect(evt) {
    const file = evt.target.files[0]
    if (!file) return
    
    setLoading(true)
    setError(null)
    
    try {
      const { signMap: newSignMap, totalMoves: total } = await processGame(file, moveNumber)
      setSignMap(newSignMap)
      setTotalMoves(total)
      
      // Read and store the SGF content
      const reader = new FileReader()
      reader.onload = (evt) => {
        const content = evt.target.result
        localStorage.setItem('lastSgfContent', content)
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
          const { signMap: newSignMap } = await processGame(file, num)
          setSignMap(newSignMap)
        } catch (err) {
          setError(err.message)
        } finally {
          setLoading(false)
        }
      }
    }
  }

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

        <div>
          <label>
            Select SGF file:
            <input
              type="file"
              accept=".sgf"
              onChange={handleFileSelect}
              style={{ marginLeft: '0.5rem' }}
            />
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
          // Open a new page (same app) with the test recall route
          const url = window.location.origin + window.location.pathname + '#/test'
          window.open(url, '_blank')
        }}>
          Test Recall
        </button>
      </div>
    </div>
  )
}
