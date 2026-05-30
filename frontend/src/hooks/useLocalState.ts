import { useState, useCallback } from 'react'

export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })

  const set = useCallback((v: T) => {
    setState(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {}
  }, [key])

  return [state, set]
}
