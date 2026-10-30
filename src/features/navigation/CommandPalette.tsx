import { type KeyboardEvent, useState } from 'react'
import type { SearchHit } from './searchIndex'

interface CommandPaletteProps {
  search: (query: string) => SearchHit[]
  /** Shown while the query is empty. */
  recents: SearchHit[]
  onClose: () => void
}

const MAX_RESULTS = 10

export function CommandPalette({ search, recents, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const searching = query.trim() !== ''
  const results = (searching ? search(query) : recents).slice(0, MAX_RESULTS)

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(Math.max(0, Math.min(active + 1, results.length - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(Math.max(active - 1, 0))
    } else if (event.key === 'Enter') {
      // Closing moves focus back to the search button; without this the same Enter would press it and reopen.
      event.preventDefault()
      const hit = results[active]
      if (!hit) return
      window.location.hash = hit.href
      onClose()
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: clicking outside is a mouse shortcut; the keyboard closes with Esc on the dialog.
    <div className="palette__backdrop" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar guías"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          type="search"
          aria-label="Buscar"
          placeholder="Tarea, marca, comando o tema…"
          autoComplete="off"
          spellCheck={false}
          // biome-ignore lint/a11y/noAutofocus: the dialog exists to type a query, so focus goes straight to it.
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
        />
        {searching && results.length === 0 && <p className="palette__note">Sin resultados.</p>}
        {!searching && results.length > 0 && <p className="palette__note">Recientes</p>}
        <ul>
          {results.map((hit, index) => (
            <li key={hit.href}>
              <a href={hit.href} aria-current={index === active ? 'true' : undefined} onClick={onClose}>
                <strong>{hit.title}</strong> <span>{hit.detail}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="palette__hint">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</p>
      </div>
    </div>
  )
}
