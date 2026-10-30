import { useId } from 'react'
import type { Catalog } from '../../domain/buildCatalog'
import { TASK_GROUPS, type TaskGroup } from '../../domain/schema'
import { platformHref, runbookHref } from '../../lib/useHashRoute'
import { GROUP_LABELS } from '../labels'

interface TaskNavProps {
  catalog: Catalog
  platform: string
  /** Task currently open; undefined on the home page. */
  task?: string
  /** True when the brand sheet itself is the page being shown. */
  onSheet: boolean
}

export function TaskNav({ catalog, platform, task, onSheet }: TaskNavProps) {
  const baseId = useId()
  const runbooks = catalog.concepts.flatMap((concept) => {
    const procedure = catalog.procedures.find((item) => item.platform === platform && item.task === concept.id)
    return procedure ? [{ concept, procedure }] : []
  })
  const inGroup = (group: TaskGroup) => runbooks.filter(({ concept }) => concept.group === group)

  return (
    <nav className="task-nav" aria-label="Tareas">
      <a className="task-nav__sheet" href={platformHref(platform)} aria-current={onSheet ? 'page' : undefined}>
        Ficha del equipo
      </a>
      {TASK_GROUPS.filter((group) => inGroup(group).length > 0).map((group) => {
        const headingId = `${baseId}-${group}`
        return (
          <div key={group} className="task-nav__group">
            <p id={headingId}>{GROUP_LABELS[group]}</p>
            {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none. */}
            <ul role="list" aria-labelledby={headingId}>
              {inGroup(group).map(({ concept, procedure }) => (
                <li key={concept.id}>
                  <a href={runbookHref(platform, concept.id)} aria-current={concept.id === task ? 'page' : undefined}>
                    {concept.title}
                  </a>
                  {procedure.status.level === 'unverified' && <span className="task-nav__flag">sin verificar</span>}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
