import { parse } from 'yaml'
import type { z } from 'zod'
import {
  type Concept,
  ConceptSchema,
  type Fundamental,
  FundamentalSchema,
  findUndeclaredParams,
  type Platform,
  PlatformSchema,
  type Procedure,
  ProcedureSchema,
  TASK_GROUPS,
} from './schema'

export interface Catalog {
  platforms: Platform[]
  concepts: Concept[]
  procedures: Procedure[]
  fundamentals: Fundamental[]
}

function parseFile<Schema extends z.ZodType>(path: string, source: string, schema: Schema): z.infer<Schema> {
  const result = schema.safeParse(parse(source))
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    throw new Error(`Invalid content in ${path}\n  ${issues.join('\n  ')}`)
  }
  return result.data
}

function assertIdMatchesFileName(path: string, id: string): void {
  if (!path.endsWith(`/${id}.yaml`)) {
    throw new Error(`Invalid content in ${path}: id "${id}" does not match the file name`)
  }
}

/** Builds the catalog from raw YAML keyed by file path, failing loudly on any inconsistency. */
export function buildCatalog(files: Record<string, string>): Catalog {
  const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
  const inFolder = (folder: string) => entries.filter(([path]) => path.includes(`/content/${folder}/`))

  const platforms = inFolder('platforms').map(([path, source]) => {
    const platform = parseFile(path, source, PlatformSchema)
    assertIdMatchesFileName(path, platform.id)
    return platform
  })

  const positions = new Map<string, string>()
  const concepts = inFolder('concepts')
    .map(([path, source]) => {
      const concept = parseFile(path, source, ConceptSchema)
      assertIdMatchesFileName(path, concept.id)

      const position = `${concept.group}/${concept.order}`
      const taken = positions.get(position)
      if (taken) {
        throw new Error(
          `Invalid content in ${path}: order ${concept.order} is already used by "${taken}" in group ${concept.group}`,
        )
      }
      positions.set(position, concept.id)
      return concept
    })
    .sort((a, b) => TASK_GROUPS.indexOf(a.group) - TASK_GROUPS.indexOf(b.group) || a.order - b.order)

  const platformIds = new Set(platforms.map((platform) => platform.id))
  const conceptIds = new Set(concepts.map((concept) => concept.id))

  const procedures = inFolder('procedures').map(([path, source]) => {
    const procedure = parseFile(path, source, ProcedureSchema)
    const fail = (reason: string): never => {
      throw new Error(`Invalid content in ${path}: ${reason}`)
    }

    if (!platformIds.has(procedure.platform)) fail(`unknown platform "${procedure.platform}"`)
    if (!conceptIds.has(procedure.task)) fail(`unknown task "${procedure.task}"`)

    const expectedPath = `procedures/${procedure.platform}/${procedure.task}.yaml`
    if (!path.endsWith(`/content/${expectedPath}`)) fail(`expected path ${expectedPath}`)

    const paramIds = new Set(procedure.params.map((param) => param.id))
    for (const param of procedure.params) {
      const other = param.differentFrom?.param
      if (other === param.id) fail(`param "${param.id}" cannot be required to differ from itself`)
      if (other && !paramIds.has(other)) fail(`param "${param.id}" must differ from undeclared param "${other}"`)
    }

    const undeclared = findUndeclaredParams(procedure)
    if (undeclared.length > 0) fail(`undeclared params: ${undeclared.join(', ')}`)

    return procedure
  })

  const fundamentalOrders = new Map<number, string>()
  const fundamentals = inFolder('fundamentals')
    .map(([path, source]) => {
      const article = parseFile(path, source, FundamentalSchema)
      assertIdMatchesFileName(path, article.id)

      const taken = fundamentalOrders.get(article.order)
      if (taken) {
        throw new Error(
          `Invalid content in ${path}: order ${article.order} is already used by "${taken}" in fundamentals`,
        )
      }
      fundamentalOrders.set(article.order, article.id)

      const unknown = article.related.find((task) => !conceptIds.has(task))
      if (unknown) throw new Error(`Invalid content in ${path}: unknown related task "${unknown}"`)
      const withoutRunbook = article.related.find((task) => !procedures.some((item) => item.task === task))
      if (withoutRunbook) throw new Error(`Invalid content in ${path}: related task "${withoutRunbook}" has no runbook`)
      return article
    })
    .sort((a, b) => a.order - b.order)

  return { platforms, concepts, procedures, fundamentals }
}
