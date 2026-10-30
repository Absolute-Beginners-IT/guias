import type { Platform } from '../../domain/schema'
import { Section } from '../../ui/Section'
import { STATUS_LABELS } from '../labels'

/** The brand sheet: how this system behaves and what it offers to undo a change. */
export function PlatformPage({ platform }: { platform: Platform }) {
  return (
    <div>
      <header className="page-header">
        <p className="eyebrow">
          {platform.vendor} · {platform.os}
        </p>
        <h1>{platform.name}</h1>
        <p className="lead">{platform.summary}</p>
        <p className="muted">Modelos: {platform.models.join(', ')}</p>
      </header>

      <Section title="Redes de seguridad">
        <p>Mecanismos propios de este sistema para deshacer un cambio. Conviene conocerlos antes de tocar nada.</p>
        <ul className="plain-list">
          {platform.safetyNets.map((net) => (
            <li key={net.name}>
              <h3>{net.name}</h3>
              <p>{net.description}</p>
              {net.commands && (
                <pre>
                  {net.commands.map((command) => (
                    <code key={command}>{command}</code>
                  ))}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Cómo se guarda la configuración">
        <p>{platform.configPersistence}</p>
      </Section>

      {platform.cliModes.length > 0 && (
        <Section title="Modos de la CLI">
          <table>
            <thead>
              <tr>
                <th>Modo</th>
                <th>Prompt</th>
                <th>Cómo se entra</th>
                <th>Para qué sirve</th>
              </tr>
            </thead>
            <tbody>
              {platform.cliModes.map((mode) => (
                <tr key={mode.name}>
                  <td>{mode.name}</td>
                  <td>
                    <code>{mode.prompt}</code>
                  </td>
                  <td>{mode.enter}</td>
                  <td>{mode.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Fuentes">
        <ul>
          {platform.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
        <p className="muted">
          {STATUS_LABELS[platform.status.level]} · {platform.status.firmware} · revisada el {platform.status.reviewed}
        </p>
      </Section>
    </div>
  )
}
