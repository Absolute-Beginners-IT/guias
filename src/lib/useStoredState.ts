import { useCallback, useState } from 'react'

function read<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? fallback : (JSON.parse(stored) as T)
  } catch {
    return fallback
  }
}

/** useState backed by localStorage; storage failures degrade to in-memory state. */
export function useStoredState<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => read(key, fallback))

  const update = useCallback(
    (value: T) => {
      setState(value)
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Private mode or a full quota: the runbook keeps working without persistence.
      }
    },
    [key],
  )

  return [state, update]
}
