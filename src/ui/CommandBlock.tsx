import { CopyButton } from './CopyButton'

interface CommandBlockProps {
  lines: string[]
  copyLabel: string
  ready: boolean
}

export function CommandBlock({ lines, copyLabel, ready }: CommandBlockProps) {
  return (
    <div className="command-block">
      <pre>
        {lines.map((line, index) => (
          <code key={index}>{line}</code>
        ))}
      </pre>
      <CopyButton text={lines.join('\n')} label={copyLabel} disabled={!ready} />
    </div>
  )
}
