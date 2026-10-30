import { Fragment, useState } from 'react'
import type { Catalog } from '../../domain/buildCatalog'
import { RISK_LEVELS, STATUS_LEVELS, TASK_GROUPS } from '../../domain/schema'
import { runbookHref } from '../../lib/useHashRoute'
import { Badge } from '../../ui/Badge'
import { Section } from '../../ui/Section'
import { GROUP_LABELS, RISK_LABELS, STATUS_LABELS } from '../labels'
import { isPending, STALE_AFTER_DAYS, summarizeCatalog } from './summarizeCatalog'

const STATUS_SHORT = { unverified: 'Sin verificar', 'docs-checked': 'Contrastada', 'lab-tested': 'Probada' } as const
const STATUS_TONES = { unverified: 'danger', 'docs-checked': 'warn', 'lab-tested': 'ok' } as const

interface StatusPageProps {
  catalog: Catalog
  /** Injected so the review deadline can be tested. */
  now?: Date
}

/** What is verified, what is pending and what needs another review, brand by brand. */
export function StatusPage({ catalog, now = new Date() }: StatusPageProps) {
  const [pendingOnly, setPendingOnly] = useState(false)
  const summary = summarizeCatalog(catalog, now)

  return (
    <div>
      <header className="page-header">
        <h1>Estado del contenido</h1>
        <p className="lead">
          Qué guías están contrastadas con la documentación, cuáles faltan por probar en un equipo real y cuáles llevan
          más de {STALE_AFTER_DAYS} días sin revisarse.
        </p>
      </header>

      <Section title="Resumen">
        <p className="status-total">{summary.total} guías</p>
        <ul className="status-summary" aria-label="Resumen por estado">
          {STATUS_LEVELS.map((level) => (
            <li key={level}>
              <strong>{summary.byStatus[level]}</strong> <span>{STATUS_LABELS[level]}</span>
            </li>
          ))}
        </ul>
        <p className="muted">
          {RISK_LEVELS.map((level) => `${RISK_LABELS[level]}: ${summary.byRisk[level]}`).join(' · ')}
          {' · '}
          Para revisar: {summary.staleCount}
        </p>
      </Section>

      <Section title="Guías por marca y tarea">
        <label className="record-check">
          <input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} />
          Solo pendientes de probar
        </label>
        <div className="status-matrix">
          <table aria-label="Guías por marca y tarea">
            <thead>
              <tr>
                <th scope="col">Tarea</th>
                {catalog.platforms.map((platform) => (
                  <th key={platform.id} scope="col">
                    {platform.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TASK_GROUPS.map((group) => (
                <Fragment key={group}>
                  <tr className="status-matrix__group">
                    <th scope="colgroup" colSpan={catalog.platforms.length + 1}>
                      {GROUP_LABELS[group]}
                    </th>
                  </tr>
                  {summary.rows
                    .filter((row) => row.concept.group === group)
                    .map((row) => (
                      <tr key={row.concept.id}>
                        <th scope="row">{row.concept.title}</th>
                        {row.cells.map(({ platform, procedure, stale }) => {
                          if (!procedure) return <td key={platform.id}>—</td>
                          if (pendingOnly && !isPending(procedure.status)) return <td key={platform.id} />
                          const level = procedure.status.level
                          return (
                            <td key={platform.id}>
                              <a
                                className="status-cell"
                                href={runbookHref(platform.id, procedure.task)}
                                aria-label={`${platform.name}: ${STATUS_SHORT[level]}, ${RISK_LABELS[procedure.risk.level].toLowerCase()}, revisada el ${procedure.status.reviewed}`}
                              >
                                <Badge label={STATUS_SHORT[level]} tone={STATUS_TONES[level]} />
                                <span className="status-cell__meta">{RISK_LABELS[procedure.risk.level]}</span>
                                {stale && <span className="status-cell__stale">Revisar</span>}
                              </a>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
