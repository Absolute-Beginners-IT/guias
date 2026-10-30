import { useState } from 'react'
import { copyText } from '../lib/copyText'

interface CopyButtonProps {
  text: string
  label: string
  disabled?: boolean
  children?: string
}

export function CopyButton({ text, label, disabled = false, children = 'Copiar' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (await copyText(text)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <>
      <button
        type="button"
        className="copy-button"
        aria-label={label}
        title={disabled ? 'Completa tus datos para poder copiar' : undefined}
        disabled={disabled}
        onClick={copy}
      >
        {copied ? 'Copiado' : children}
      </button>
      {/* The button text changes silently for screen readers; this announces the copy. */}
      <span className="visually-hidden" role="status">
        {copied ? 'Copiado al portapapeles' : ''}
      </span>
    </>
  )
}
