import type { Catalog } from '../../domain/buildCatalog'
import { type Concept, type Platform, type Procedure, RISK_LEVELS, STATUS_LEVELS } from '../../domain/schema'

/** A runbook whose last review is older than this needs another look at the vendor documentation. */
export const STALE_AFTER_DAYS = 180
const DAY_MS = 24 * 60 * 60 * 1000

export interface StatusCell {
  platform: Platform
  procedure?: Procedure
  stale: boolean
}

export interface StatusRow {
  concept: Concept
  cells: StatusCell[]
}

export interface CatalogSummary {
  total: number
  byStatus: Record<Procedure['status']['level'], number>
  byRisk: Record<Procedure['risk']['level'], number>
  staleCount: number
  rows: StatusRow[]
}

/** Anything not yet run on real equipment still needs a lab test. */
export const isPending = (status: Procedure['status']) => status.level !== 'lab-tested'

const countBy = <Key extends string>(keys: readonly Key[], values: Key[]) =>
  Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length])) as Record<Key, number>

const isStale = (reviewed: string, now: Date) => {
  const [year = 0, month = 1, day = 1] = reviewed.split('-').map(Number)
  return now.getTime() - new Date(year, month - 1, day).getTime() > STALE_AFTER_DAYS * DAY_MS
}

/** The whole catalog as a task × brand matrix, with totals by status and risk. */
export function summarizeCatalog(catalog: Catalog, now: Date): CatalogSummary {
  const rows = catalog.concepts.map((concept) => ({
    concept,
    cells: catalog.platforms.map((platform) => {
      const procedure = catalog.procedures.find((item) => item.platform === platform.id && item.task === concept.id)
      return { platform, procedure, stale: procedure ? isStale(procedure.status.reviewed, now) : false }
    }),
  }))

  return {
    total: catalog.procedures.length,
    byStatus: countBy(
      STATUS_LEVELS,
      catalog.procedures.map((item) => item.status.level),
    ),
    byRisk: countBy(
      RISK_LEVELS,
      catalog.procedures.map((item) => item.risk.level),
    ),
    staleCount: rows.flatMap((row) => row.cells).filter((cell) => cell.stale).length,
    rows,
  }
}
