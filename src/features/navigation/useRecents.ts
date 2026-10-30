import { useCallback } from 'react'
import { useStoredState } from '../../lib/useStoredState'

const MAX_RECENTS = 5

/** Keys (`platform/task`) of the runbooks opened most recently, newest first. */
export function useRecents(): [string[], (key: string) => void] {
  const [keys, setKeys] = useStoredState<string[]>('switching-manual:recents', [])

  const remember = useCallback(
    (key: string) => {
      if (keys[0] === key) return
      setKeys([key, ...keys.filter((item) => item !== key)].slice(0, MAX_RECENTS))
    },
    [keys, setKeys],
  )

  return [keys, remember]
}
