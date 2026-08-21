import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'macro-market-radar:last-snapshot'

function readStoredSnapshot() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function useMarketData() {
  const [snapshot, setSnapshot] = useState(() => readStoredSnapshot())
  const [loading, setLoading] = useState(!snapshot)
  const [error, setError] = useState('')

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/market${force ? `?refresh=1&t=${Date.now()}` : ''}`)
      if (!response.ok) throw new Error(`数据接口返回 ${response.status}`)
      const nextSnapshot = await response.json()
      setSnapshot(nextSnapshot)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSnapshot))
    } catch (nextError) {
      setError(nextError.message)
      if (!snapshot) setSnapshot(readStoredSnapshot())
    } finally {
      setLoading(false)
    }
  }, [snapshot])

  useEffect(() => {
    load(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { snapshot, loading, error, refresh: () => load(true) }
}
