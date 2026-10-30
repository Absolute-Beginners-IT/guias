import { useId, useState } from 'react'
import { extractParamIds, type ParamValues, renderCommand } from '../../domain/renderCommand'
import type { Concept, Platform, Procedure, RiskLevel, StatusLevel } from '../../domain/schema'
import { validateParam } from '../../domain/validateParam'
import { useStoredState } from '../../lib/useStoredState'
import { Badge } from '../../ui/Badge'
import { CommandBlock } from '../../ui/CommandBlock'
import { CopyButton } from '../../ui/CopyButton'
import { Section } from '../../ui/Section'
import { RISK_LABELS, STATUS_LABELS } from '../labels'
import { ChangeRecordSection } from './ChangeRecordSection'
import { buildChangeRecord, changeRecordFileName, EMPTY_RECORD, type RecordFields } from './changeRecord'
import { runbookStorageKey } from './runbookStorage'

interface RunbookPageProps {
  platform: Platform
  concept: Concept
  procedure: Procedure
  /** Runbooks for this same task on the other brands. */
  alternatives?: { name: string; href: string }[]
}

const RISK_TONES: Record<RiskLevel, 'ok' | 'warn' | 'danger'> = { low: 'ok', medium: 'warn', high: 'danger' }
const STATUS_TONES: Record<StatusLevel, 'ok' | 'warn' | 'danger'> = {
  unverified: 'danger',
  'docs-checked': 'warn',
  'lab-tested': 'ok',
}

interface StepCommandsProps {
  manual: boolean
  /** How a manual step is announced: a web-managed switch is configured by hand on every step. */
  manualLabel: string
  lines: string[]
  copyLabel: string
  ready: boolean
}

/** A step either runs commands or is done by hand; this is the single place that tells them apart. */
function StepCommands({ manual, manualLabel, lines, copyLabel, ready }: StepCommandsProps) {
  if (manual) return <p className="manual-tag">{manualLabel}</p>
  return <CommandBlock lines={lines} copyLabel={copyLabel} ready={ready} />
}

// Sections the user jumps between while working; "Fuentes" is reference material and stays out.
const WORKING_SECTIONS = [
  { key: 'data', title: 'Tus datos' },
  { key: 'preflight', title: 'Antes de empezar' },
  { key: 'steps', title: 'Paso a paso' },
  { key: 'verification', title: 'Verificación' },
  { key: 'rollback', title: 'Vuelta atrás' },
] as const

export function RunbookPage({ platform, concept, procedure, alternatives = [] }: RunbookPageProps) {
  const baseId = useId()
  const sectionId = (key: (typeof WORKING_SECTIONS)[number]['key']) => `${baseId}-${key}`
  const storageKey = runbookStorageKey(procedure.platform, procedure.task)
  const [storedValues, setStoredValues] = useStoredState<Record<string, string>>(`${storageKey}:values`, {})
  // Secrets live only in memory: reloading or leaving the runbook forgets them.
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const secretIds = new Set(procedure.params.filter((param) => param.type === 'secret').map((param) => param.id))
  // Drops any secret a stored map may still hold, so it is neither shown nor written back.
  const plainValues = Object.fromEntries(Object.entries(storedValues).filter(([id]) => !secretIds.has(id)))
  const values = { ...plainValues, ...secrets }
  const [doneSteps, setDoneSteps] = useStoredState<number[]>(`${storageKey}:done`, [])
  const [storedRecord, setRecord] = useStoredState<RecordFields>(`${storageKey}:record`, EMPTY_RECORD)
  // Fills fields a record saved by an older version may lack.
  const record = { ...EMPTY_RECORD, ...storedRecord }

  const errors = Object.fromEntries(
    procedure.params.map((param) => [param.id, validateParam(param, values[param.id] ?? '', values)]),
  )
  // Invalid values are treated as unfilled so a wrong command is never shown as runnable.
  const validValues: ParamValues = Object.fromEntries(
    procedure.params.filter((param) => errors[param.id] === null).map((param) => [param.id, values[param.id]]),
  )

  const fill = (template: string) => renderCommand(template, validValues)
  const isReady = (templates: string[]) =>
    templates.flatMap(extractParamIds).every((id) => Boolean(validValues[id]?.trim()))

  const allStepCommands = procedure.steps.flatMap((step) => step.commands)
  const manualLabel = platform.management === 'web' ? 'Paso en la interfaz web' : 'Acción manual'

  const toggleStep = (index: number) =>
    setDoneSteps(doneSteps.includes(index) ? doneSteps.filter((step) => step !== index) : [...doneSteps, index])

  const reset = () => {
    setStoredValues({})
    setSecrets({})
    setDoneSteps([])
    setRecord(EMPTY_RECORD)
  }

  const renderRecord = () => {
    const now = new Date()
    return {
      text: buildChangeRecord({ platform, concept, procedure, values: validValues, doneSteps, record, now }),
      fileName: changeRecordFileName(procedure, now),
    }
  }

  return (
    <article className="runbook">
      <header className="page-header">
        <p className="eyebrow">
          {platform.vendor} · {platform.name} · {platform.os}
        </p>
        <h1>{concept.title}</h1>
        <p className="lead">{procedure.summary}</p>
        <div className="status-line">
          <Badge label={STATUS_LABELS[procedure.status.level]} tone={STATUS_TONES[procedure.status.level]} />
          <span>
            {procedure.status.firmware} · revisada el {procedure.status.reviewed}
          </span>
        </div>
        {procedure.status.level === 'unverified' ? (
          <aside className="notice notice--warn" role="note" aria-labelledby={`${baseId}-unverified`}>
            <strong id={`${baseId}-unverified`}>Guía sin verificar</strong>
            <p>
              Algún paso no se ha podido confirmar en la documentación oficial. Pruébala antes en un equipo de
              laboratorio.
            </p>
            {procedure.status.notes && <p>{procedure.status.notes}</p>}
          </aside>
        ) : (
          procedure.status.notes && <p className="muted">{procedure.status.notes}</p>
        )}
        {alternatives.length > 0 && (
          <nav className="alternatives" aria-label="Misma tarea en otra marca">
            <span>Misma tarea en:</span>
            {alternatives.map((alternative) => (
              <a key={alternative.href} href={alternative.href}>
                {alternative.name}
              </a>
            ))}
          </nav>
        )}
      </header>

      <aside className={`risk risk--${procedure.risk.level}`}>
        <Badge label={RISK_LABELS[procedure.risk.level]} tone={RISK_TONES[procedure.risk.level]} />
        <p>{procedure.risk.reason}</p>
        <ul>
          {concept.risks.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ul>
      </aside>

      <details className="concept">
        <summary>Qué es y para qué sirve</summary>
        <p>{concept.explanation}</p>
        {concept.prerequisites.length > 0 && (
          <ul>
            {concept.prerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </details>

      {/* Buttons instead of #anchors: the hash is the route, so an anchor would navigate away. */}
      <nav className="section-index" aria-label="Secciones de la guía">
        {WORKING_SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => document.getElementById(sectionId(item.key))?.scrollIntoView({ behavior: 'smooth' })}
          >
            {item.title}
          </button>
        ))}
      </nav>

      <Section
        id={sectionId('data')}
        title="Tus datos"
        actions={
          <button type="button" className="link-button" onClick={reset}>
            Limpiar datos y progreso
          </button>
        }
      >
        {procedure.params.length === 0 && <p className="muted">Esta guía no necesita datos tuyos.</p>}
        <form className="params" onSubmit={(event) => event.preventDefault()}>
          {procedure.params.map((param) => {
            const value = values[param.id] ?? ''
            const error = value.trim() === '' ? null : errors[param.id]
            const fieldId = `param-${param.id}`
            const secret = secretIds.has(param.id)
            const update = (next: string) =>
              secret
                ? setSecrets({ ...secrets, [param.id]: next })
                : setStoredValues({ ...plainValues, [param.id]: next })

            return (
              <div className="field" key={param.id}>
                <label htmlFor={fieldId}>{param.label}</label>
                {param.type === 'choice' ? (
                  <select id={fieldId} value={value} onChange={(event) => update(event.target.value)}>
                    <option value="">Elige…</option>
                    {param.options?.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={fieldId}
                    value={value}
                    placeholder={`Ej.: ${param.example}`}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={error ? true : undefined}
                    onChange={(event) => update(event.target.value)}
                  />
                )}
                {param.help && <p className="muted">{param.help}</p>}
                {secret && (
                  <p className="muted">
                    No se guarda en el navegador ni en el registro del cambio: se borra al recargar la página.
                  </p>
                )}
                {error && (
                  <p className="field__error" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )
          })}
        </form>
      </Section>

      <Section id={sectionId('preflight')} title="Antes de empezar">
        <ol className="checks">
          {procedure.preflight.map((check, index) => (
            <li key={index}>
              <p>{fill(check.text)}</p>
              {check.command && (
                <CommandBlock
                  lines={[fill(check.command)]}
                  copyLabel={`Copiar comprobación ${index + 1}`}
                  ready={isReady([check.command])}
                />
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id={sectionId('steps')}
        title="Paso a paso"
        actions={
          allStepCommands.length > 0 && (
            <CopyButton
              text={allStepCommands.map(fill).join('\n')}
              label="Copiar todos los pasos"
              disabled={!isReady(allStepCommands)}
            >
              Copiar todo
            </CopyButton>
          )
        }
      >
        <ol className="steps">
          {procedure.steps.map((step, index) => (
            <li key={index} className={doneSteps.includes(index) ? 'step step--done' : 'step'}>
              <div className="step__title">
                <input
                  type="checkbox"
                  aria-label={`Hecho: ${step.title}`}
                  checked={doneSteps.includes(index)}
                  onChange={() => toggleStep(index)}
                />
                <h3>{step.title}</h3>
              </div>
              {step.warning && <p className="warning">{fill(step.warning)}</p>}
              <StepCommands
                manual={step.manual}
                manualLabel={manualLabel}
                lines={step.commands.map(fill)}
                copyLabel={`Copiar: ${step.title}`}
                ready={isReady(step.commands)}
              />
              <p>{fill(step.explanation)}</p>
              {step.breakdown && (
                <dl className="breakdown">
                  {step.breakdown.map((part) => (
                    <div key={part.token}>
                      <dt>
                        <code>{fill(part.token)}</code>
                      </dt>
                      <dd>{fill(part.meaning)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section id={sectionId('verification')} title="Verificación">
        <ol className="checks">
          {procedure.verification.map((check, index) => (
            <li key={index}>
              {check.command && (
                <CommandBlock
                  lines={[fill(check.command)]}
                  copyLabel={`Copiar verificación ${index + 1}`}
                  ready={isReady([check.command])}
                />
              )}
              <p>
                <strong>Qué deberías ver:</strong> {fill(check.expect)}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id={sectionId('rollback')} title="Vuelta atrás">
        <p>{fill(procedure.rollback.summary)}</p>
        <ol className="steps">
          {procedure.rollback.steps.map((step, index) => {
            const title = step.title ?? `Paso ${index + 1}`
            return (
              <li key={index} className="step">
                <h3>{title}</h3>
                {step.warning && <p className="warning">{fill(step.warning)}</p>}
                <StepCommands
                  manual={step.manual}
                  manualLabel={manualLabel}
                  lines={step.commands.map(fill)}
                  copyLabel={`Copiar vuelta atrás: ${title}`}
                  ready={isReady(step.commands)}
                />
                <p>{fill(step.explanation)}</p>
              </li>
            )
          })}
        </ol>
        {procedure.rollback.lockoutRecovery && (
          <div className="lockout">
            <h3>Si pierdes el acceso al switch</h3>
            <p>{fill(procedure.rollback.lockoutRecovery)}</p>
          </div>
        )}
      </Section>

      <ChangeRecordSection record={record} onChange={setRecord} render={renderRecord} />

      <Section title="Fuentes">
        <ul>
          {procedure.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </article>
  )
}
