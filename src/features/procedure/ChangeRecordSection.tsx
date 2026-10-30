import { useId } from 'react'
import { CopyButton } from '../../ui/CopyButton'
import { Section } from '../../ui/Section'
import type { RecordFields } from './changeRecord'

interface ChangeRecordSectionProps {
  record: RecordFields
  onChange: (record: RecordFields) => void
  /** Builds the Markdown at the moment it is needed, so the timestamp is the time of use. */
  render: () => { text: string; fileName: string }
}

function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** Documents the change for the ticket or the maintenance window: where, which ticket, outcome and notes. */
export function ChangeRecordSection({ record, onChange, render }: ChangeRecordSectionProps) {
  const baseId = useId()
  const update = (fields: Partial<RecordFields>) => onChange({ ...record, ...fields })

  return (
    <Section title="Registro del cambio">
      <p>
        Completa estos datos y genera el registro con los valores, los pasos marcados y el resultado, listo para el
        ticket o la ventana de mantenimiento.
      </p>
      <div className="params">
        <div className="field">
          <label htmlFor={`${baseId}-device`}>Equipo (nombre o IP)</label>
          <input
            id={`${baseId}-device`}
            value={record.device}
            placeholder="SW-PLANTA2"
            autoComplete="off"
            onChange={(event) => update({ device: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={`${baseId}-ticket`}>Ticket o referencia</label>
          <input
            id={`${baseId}-ticket`}
            value={record.ticket}
            placeholder="INC-1234"
            autoComplete="off"
            onChange={(event) => update({ ticket: event.target.value })}
          />
        </div>
      </div>
      <label className="record-check">
        <input
          type="checkbox"
          checked={record.verified}
          onChange={(event) => update({ verified: event.target.checked })}
        />
        Verificación correcta
      </label>
      <div className="field">
        <label htmlFor={`${baseId}-notes`}>Notas</label>
        <textarea
          id={`${baseId}-notes`}
          rows={3}
          value={record.notes}
          placeholder="Incidencias, quién lo aprobó, ventana de mantenimiento…"
          onChange={(event) => update({ notes: event.target.value })}
        />
      </div>
      <div className="record-actions">
        <CopyButton text={render().text} label="Copiar registro del cambio">
          Copiar registro
        </CopyButton>
        <button
          type="button"
          className="copy-button"
          onClick={() => {
            const { text, fileName } = render()
            download(text, fileName)
          }}
        >
          Descargar .md
        </button>
        <button type="button" className="copy-button" onClick={() => window.print()}>
          Imprimir o guardar como PDF
        </button>
      </div>
    </Section>
  )
}
