import { useState, useEffect } from 'preact/hooks'
import TestRecall from './TestRecall'
import ValidateRecall from './ValidateRecall'
import TrainRecall from './TrainRecall'

export default function App() {
  const [currentHash, setCurrentHash] = useState(
    typeof window !== 'undefined' ? window.location.hash : ''
  )

  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (currentHash === '#/test') return <TestRecall />
  if (currentHash === '#/validate') return <ValidateRecall />
  return <TrainRecall />
}
