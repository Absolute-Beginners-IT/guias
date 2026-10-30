import { THEMES, type Theme, useTheme } from '../../lib/useTheme'

const THEME_LABELS: Record<Theme, string> = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' }

const ICONS: Record<Theme, string> = {
  // A screen: follow the operating system.
  system: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  // A sun.
  light:
    'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  // A crescent moon.
  dark: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
}

/** One button in the header that cycles system → light → dark and shows the current choice. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'system'
  const label = `Tema: ${THEME_LABELS[theme]}. Cambiar a ${THEME_LABELS[next]}`

  return (
    <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={() => setTheme(next)}>
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICONS[theme]} />
      </svg>
    </button>
  )
}
