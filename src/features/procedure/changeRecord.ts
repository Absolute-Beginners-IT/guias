import { type ParamValues, renderCommand } from '../../domain/renderCommand'
import type { Concept, Platform, Procedure } from '../../domain/schema'
import { RISK_LABELS, STATUS_LABELS } from '../labels'

/** What the technician adds to the runbook to document one specific change. */
export interface RecordFields {
  device: string
  ticket: string
  notes: string
  verified: boolean
}

export const EMPTY_RECORD: RecordFields = { device: '', ticket: '', notes: '', verified: false }

interface ChangeRecordInput {
  platform: Platform
  concept: Concept
  procedure: Procedure
  /** Only valid values; anything else is rendered as a placeholder. */
  values: ParamValues
  doneSteps: number[]
  record: RecordFields
  now: Date
}

const SECRET_MASK = '********'
const isSecret = (procedure: Procedure, id: string) =>
  procedure.params.some((param) => param.id === id && param.type === 'secret')

const pad = (value: number) => String(value).padStart(2, '0')
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const localDateTime = (date: Date) => `${isoDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
const orDash = (text: string) => text.trim() || '—'
// A pipe would end the table cell early.
const cell = (text: string) => text.replaceAll('|', '\\|')

const codeBlock = (lines: string[]) => ['   ```', ...lines.map((line) => `   ${line}`), '   ```'].join('\n')

interface StepLike {
  title?: string
  commands: string[]
  manual: boolean
  explanation: string
}

const stepBody = (step: StepLike, fill: (text: string) => string) =>
  step.manual ? `   Paso manual: ${fill(step.explanation)}` : codeBlock(step.commands.map(fill))

/** Markdown record of a change, ready to paste into a ticket or keep with the maintenance window. */
export function buildChangeRecord({
  platform,
  concept,
  procedure,
  values,
  doneSteps,
  record,
  now,
}: ChangeRecordInput): string {
  // The record ends up in tickets and shared folders, so secrets are masked even where the commands use them.
  const shown: ParamValues = Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, isSecret(procedure, id) && value ? SECRET_MASK : value]),
  )
  const fill = (text: string) => renderCommand(text, shown)
  const { status, risk } = procedure
  const doneCount = procedure.steps.filter((_, index) => doneSteps.includes(index)).length

  const summary = [
    '| Campo | Valor |',
    '|-------|-------|',
    `| Fecha | ${localDateTime(now)} |`,
    `| Equipo | ${cell(orDash(record.device))} |`,
    `| Ticket o referencia | ${cell(orDash(record.ticket))} |`,
    `| Marca y modelo | ${platform.vendor} ${platform.name} (${platform.os}) |`,
    `| Guía | ${STATUS_LABELS[status.level]} · ${status.firmware} · revisada el ${status.reviewed} |`,
    `| Riesgo | ${RISK_LABELS[risk.level]}: ${cell(risk.reason)} |`,
  ].join('\n')

  const valueLines = procedure.params.map((param) => {
    const value = shown[param.id]?.trim()
    return `- ${param.label}: ${value || 'sin rellenar'}`
  })

  const preflight = procedure.preflight.map(
    (check) => `- ${fill(check.text)}${check.command ? ` \`${fill(check.command)}\`` : ''}`,
  )

  const steps = procedure.steps.map((step, index) => {
    const mark = doneSteps.includes(index) ? 'x' : ' '
    return `${index + 1}. [${mark}] ${step.title}\n\n${stepBody(step, fill)}`
  })

  const checks = procedure.verification.map(
    (check) => `- ${fill(check.expect)}${check.command ? ` \`${fill(check.command)}\`` : ''}`,
  )

  const rollback = procedure.rollback.steps.map(
    (step, index) => `${index + 1}. ${step.title ?? `Paso ${index + 1}`}\n\n${stepBody(step, fill)}`,
  )

  const sections = [
    `# Registro de cambio: ${concept.title}`,
    summary,
    `## Valores\n\n${valueLines.length > 0 ? valueLines.join('\n') : 'Esta guía no necesita valores.'}`,
    `## Antes de empezar\n\n${preflight.join('\n')}`,
    `## Paso a paso (${doneCount} de ${procedure.steps.length} hechos)\n\n${steps.join('\n\n')}`,
    `## Verificación\n\nResultado: ${record.verified ? 'correcta' : 'pendiente de confirmar'}\n\n${checks.join('\n')}`,
    `## Vuelta atrás\n\n${fill(procedure.rollback.summary)}\n\n${rollback.join('\n\n')}`,
  ]
  if (record.notes.trim()) sections.push(`## Notas\n\n${record.notes.trim()}`)

  return `${sections.join('\n\n')}\n`
}

export const changeRecordFileName = (procedure: Procedure, now: Date) =>
  `${isoDate(now)}_${procedure.platform}_${procedure.task}.md`
