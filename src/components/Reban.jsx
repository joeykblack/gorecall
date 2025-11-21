import { useEffect, useRef, useState } from 'preact/hooks'
import '@sabaki/shudan/css/goban.css'
import { Goban } from '@sabaki/shudan'

// Reban: a small wrapper around Sabaki's Goban that measures available
// container width and computes a responsive vertexSize so a 19x19 board
// fits on smaller viewports.
export default function Reban({
  signMap = [],
  markerMap = undefined,
  onVertexClick = undefined,
  showCoordinates = true,
  style = {},
  className = '',
  maxWidth = '800px',
  maxVertex = 32,
  minVertex = 12,
  boardPadding = 16
}) {
  const containerRef = useRef(null)
  const [vertexSize, setVertexSize] = useState(maxVertex)

  useEffect(() => {
    const size = (signMap && signMap.length) || 19

    function recompute() {
      const container = containerRef.current
      const availableWidth = container ? container.clientWidth : window.innerWidth
      // conservative divisor: use size+1 to leave some margins for coordinates
      const tentative = Math.floor((availableWidth - 2 * boardPadding) / Math.max(1, size + 1))
      const v = Math.max(minVertex, Math.min(maxVertex, tentative || minVertex))
      setVertexSize(v)
    }

    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('orientationchange', recompute)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('orientationchange', recompute)
    }
  }, [signMap, maxVertex, minVertex, boardPadding])

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', maxWidth, boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
      <Goban
        signMap={signMap.map(row => row.map(cell => cell?.sign || 0))}
        markerMap={markerMap}
        vertexSize={vertexSize}
        showCoordinates={showCoordinates}
        onVertexClick={onVertexClick}
        style={{ margin: '0.5rem 0', ...style }}
      />
    </div>
  )
}
