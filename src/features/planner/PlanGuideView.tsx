import { useId } from 'react'
import { extractParamIds, renderCommand } from '../../domain/renderCommand'
import { runbookHref } from '../../lib/useHashRoute'
import { Badge } from '../../ui/Badge'
import { CommandBlock } from '../../ui/CommandBlock'
import { STATUS_LABELS } from '../labels'
import { runbookStorageKey } from '../procedure/runbookStorage'
import type { GuideStep, SwitchGuide } from './buildPlanGuide'

const STATUS_TONES = { unverified: 'danger', 'docs-checked': 'warn', 'lab-tested': 'ok' } as const

/** Hands the values to the full runbook, which reads them from storage when it opens. */
function openRunbook(step: GuideStep) {
  const key = runbookStorageKey(step.procedure.platform, step.procedure.task)
  try {
    localStorage.setItem(`${key}:values`, JSON.stringify(step.values))
    localStorage.setItem(`${key}:done`, JSON.stringify([]))
  } catch {
    // Without storage the runbook still opens, just without the values filled.
  }
  window.location.hash = runbookHref(step.procedure.platform, step.procedure.task)
}

function StepItem({ step, manualLabel }: { step: GuideStep; manualLabel: string }) {
  const titleId = useId()
  const fill = (template: string) => renderCommand(template, step.values)
  const ready = (templates: string[]) => templates.flatMap(extractParamIds).every((id) => step.values[id] !== undefined)

  return (
    <li className="plan-step" aria-labelledby={titleId}>
      <div className="plan-step__header">
        <h3 id={titleId}>{step.title}</h3>
        <Badge label={STATUS_LABELS[step.procedure.status.level]} tone={STATUS_TONES[step.procedure.status.level]} />
      </div>
      <p className="muted">
        Guía: <a href={runbookHref(step.procedure.platform, step.procedure.task)}>{step.concept.title}</a>. Haz antes
        sus comprobaciones y ten a mano su vuelta atrás.
      </p>
      {step.pending.length > 0 && (
        <p className="notice notice--warn">
          Te falta: {step.pending.map((param) => param.label).join(', ')}. Complétalo en la guía completa: su ayuda y
          «Antes de empezar» te dicen de dónde sacarlo.
        </p>
      )}
      {/* Folded so the whole plan reads as an index; the commands open one step at a time. */}
      <details className="plan-commands">
        <summary>Ver los {step.procedure.steps.length} pasos con los comandos</summary>
        <ol className="plan-substeps">
          {step.procedure.steps.map((substep, index) => (
            <li key={index}>
              <strong>{substep.title}</strong>
              {substep.manual ? (
                <>
                  <span className="manual-tag">{manualLabel}</span>
                  <p>{fill(substep.explanation)}</p>
                </>
              ) : (
                <CommandBlock
                  lines={substep.commands.map(fill)}
                  copyLabel={`Copiar: ${step.title}, ${substep.title}`}
                  ready={ready(substep.commands)}
                />
              )}
            </li>
          ))}
        </ol>
      </details>
      <button type="button" className="plan-open" onClick={() => openRunbook(step)}>
        Abrir la guía con estos datos
      </button>
    </li>
  )
}

function SwitchSection({ guide, position }: { guide: SwitchGuide; position: number }) {
  const headingId = useId()
  const { plannedSwitch, platform } = guide
  const manualLabel = platform?.management === 'web' ? 'Paso en la interfaz web' : 'Acción manual'

  return (
    <section className="section plan-switch" aria-labelledby={headingId}>
      <h2 id={headingId}>
        {position}. {plannedSwitch.name} · {platform?.name ?? 'Modelo fuera del manual'}
      </h2>
      {guide.notes.map((note) => (
        <p key={note} className="muted">
          {note}
        </p>
      ))}
      {guide.steps.length > 0 && (
        <ol className="plan-steps">
          {guide.steps.map((step) => (
            <StepItem key={step.key} step={step} manualLabel={manualLabel} />
          ))}
        </ol>
      )}
    </section>
  )
}

export function PlanGuideView({ guides }: { guides: SwitchGuide[] }) {
  return (
    <>
      <p className="muted">
        Configura los switches en este orden: del núcleo hacia fuera. En cada uno, primero las VLAN, después los
        enlaces, luego la IP de gestión y al final los puertos de acceso, para no perder nunca el acceso al equipo. La
        guía no cubre el enrutamiento entre VLAN, el DHCP ni el cortafuegos: eso va en el router o en el cortafuegos.
      </p>
      {guides.map((guide, index) => (
        <SwitchSection key={guide.plannedSwitch.id} guide={guide} position={index + 1} />
      ))}
    </>
  )
}
