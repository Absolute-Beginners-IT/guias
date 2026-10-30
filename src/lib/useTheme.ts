import { useEffect } from 'react'
import { useStoredState } from './useStoredState'

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

/** The chosen theme, applied as data-theme on <html>; "system" leaves it to prefers-color-scheme. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [stored, setTheme] = useStoredState<string>('switching-manual:theme', 'system')
  const theme: Theme = (THEMES as readonly string[]).includes(stored) ? (stored as Theme) : 'system'

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  return [theme, setTheme]
}
