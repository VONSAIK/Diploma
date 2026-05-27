import { useState, useCallback } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const run = useCallback(async (promise: Promise<{ data: T }>) => {
    setState({ data: null, loading: true, error: null })
    try {
      const res = await promise
      setState({ data: res.data, loading: false, error: null })
      return res.data
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Сталася помилка'
      setState({ data: null, loading: false, error: msg })
      return null
    }
  }, [])

  return { ...state, run }
}
