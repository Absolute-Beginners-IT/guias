import { z } from 'zod'
import { extractParamIds } from './renderCommand'

const text = z.string().trim().min(1)
const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)

export const TASK_GROUPS = ['setup-access', 'vlans-ports', 'monitoring', 'security-resilience'] as const
export const RISK_LEVELS = ['low', 'medium', 'high'] as const
export const STATUS_LEVELS = ['unverified', 'docs-checked', 'lab-tested'] as const

const SourceSchema = z.object({ title: text, url: z.url() })

const StatusSchema = z.object({
  level: z.enum(STATUS_LEVELS),
  reviewed: z.iso.date(),
  firmware: text,
  notes: text.optional(),
})

export const ParamSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/),
    label: text,
    // A secret, such as an SNMPv3 key, fills commands but is never stored in the browser nor written to the record.
    type: z.enum(['text', 'secret', 'number', 'vlan-id', 'ipv4', 'cidr', 'choice']),
    example: text,
    help: text.optional(),
    required: z.boolean().default(true),
    options: z.array(text).min(2).optional(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    pattern: text.optional(),
    patternHint: text.optional(),
    // For pairs that must not coincide, such as the image to overwrite and the one kept as fallback.
    differentFrom: z.object({ param: z.string(), hint: text }).optional(),
  })
  .refine((param) => param.type !== 'choice' || param.options !== undefined, {
    message: 'A choice param needs options',
  })

const stepFields = {
  title: text.optional(),
  commands: z.array(text).default([]),
  // Marks an action done by hand, such as pressing a key or downloading a file. Declaring it
  // explicitly keeps a step that merely forgot its commands from passing as valid.
  manual: z.boolean().default(false),
  explanation: text,
  breakdown: z.array(z.object({ token: text, meaning: text })).optional(),
  warning: text.optional(),
}

const hasCommandsUnlessManual = (step: { manual: boolean; commands: string[] }) =>
  step.manual ? step.commands.length === 0 : step.commands.length > 0
const manualRule = { message: 'A step needs commands, or manual: true and no commands', path: ['commands'] }

const RollbackStepSchema = z.object(stepFields).refine(hasCommandsUnlessManual, manualRule)
const StepSchema = z.object({ ...stepFields, title: text }).refine(hasCommandsUnlessManual, manualRule)

export const ProcedureSchema = z.object({
  platform: id,
  task: id,
  summary: text,
  risk: z.object({ level: z.enum(RISK_LEVELS), reason: text }),
  params: z.array(ParamSchema).default([]),
  preflight: z.array(z.object({ text, command: text.optional() })).min(1),
  steps: z.array(StepSchema).min(1),
  // Without a command, the check is read on screen, as in a web-managed switch.
  verification: z.array(z.object({ command: text.optional(), expect: text })).min(1),
  rollback: z.object({
    summary: text,
    steps: z.array(RollbackStepSchema).min(1),
    lockoutRecovery: text.optional(),
  }),
  sources: z.array(SourceSchema).min(1),
  status: StatusSchema,
})

export const ConceptSchema = z.object({
  id,
  title: text,
  group: z.enum(TASK_GROUPS),
  // Position inside the group, so tasks read in the order they are usually done.
  order: z.number().int().min(1),
  summary: text,
  explanation: text,
  risks: z.array(text).min(1),
  prerequisites: z.array(text).default([]),
})

export const PlatformSchema = z
  .object({
    id,
    vendor: text,
    name: text,
    os: text,
    models: z.array(text).min(1),
    summary: text,
    // How the runbooks of this platform are carried out: typed commands or steps in its web interface.
    management: z.enum(['cli', 'web']).default('cli'),
    cliModes: z.array(z.object({ name: text, prompt: text, enter: text, description: text })).default([]),
    configPersistence: text,
    safetyNets: z.array(z.object({ name: text, description: text, commands: z.array(text).optional() })).min(1),
    sources: z.array(SourceSchema).min(1),
    status: StatusSchema,
  })
  .refine((platform) => platform.management === 'web' || platform.cliModes.length > 0, {
    message: 'A platform managed from the command line needs its CLI modes',
    path: ['cliModes'],
  })

// Background reading that is not tied to a brand: what a switch is, how it is managed, who makes them.
export const FundamentalSchema = z.object({
  id,
  title: text,
  order: z.number().int().min(1),
  summary: text,
  sections: z
    .array(z.object({ heading: text, paragraphs: z.array(text).min(1), points: z.array(text).default([]) }))
    .min(1),
  // Tasks whose runbooks put the article into practice.
  related: z.array(id).default([]),
})

export type Param = z.infer<typeof ParamSchema>
export type Procedure = z.infer<typeof ProcedureSchema>
export type Concept = z.infer<typeof ConceptSchema>
export type Platform = z.infer<typeof PlatformSchema>
export type Fundamental = z.infer<typeof FundamentalSchema>
export type TaskGroup = (typeof TASK_GROUPS)[number]
export type RiskLevel = (typeof RISK_LEVELS)[number]
export type StatusLevel = (typeof STATUS_LEVELS)[number]

/** Placeholder ids used anywhere in a procedure's commands that no param declares. */
export function findUndeclaredParams(procedure: Procedure): string[] {
  const declared = new Set(procedure.params.map((param) => param.id))
  const templates = [
    ...procedure.preflight.flatMap((check) => (check.command ? [check.command] : [])),
    ...procedure.steps.flatMap((step) => step.commands),
    ...procedure.verification.flatMap((check) => (check.command ? [check.command] : [])),
    ...procedure.rollback.steps.flatMap((step) => step.commands),
  ]
  const used = new Set(templates.flatMap(extractParamIds))
  return [...used].filter((paramId) => !declared.has(paramId))
}
