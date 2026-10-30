import { catalog } from '../../content/catalog'
import { isPending, summarizeCatalog } from './summarizeCatalog'

const now = new Date(2026, 9, 15)

describe('summarizeCatalog', () => {
  it('counts every runbook by status and by risk', () => {
    const summary = summarizeCatalog(catalog, now)
    const sum = (counts: Record<string, number>) => Object.values(counts).reduce((total, count) => total + count, 0)

    expect(summary.total).toBe(catalog.procedures.length)
    expect(sum(summary.byStatus)).toBe(summary.total)
    expect(sum(summary.byRisk)).toBe(summary.total)
    expect(summary.byStatus.unverified).toBe(
      catalog.procedures.filter((item) => item.status.level === 'unverified').length,
    )
  })

  it('lays out one row per task, in working order, with one cell per brand', () => {
    const { rows } = summarizeCatalog(catalog, now)

    expect(rows.map((row) => row.concept.id)).toEqual(catalog.concepts.map((concept) => concept.id))
    expect(rows.every((row) => row.cells.length === catalog.platforms.length)).toBe(true)
  })

  it('leaves the cell empty when a brand has no runbook for the task', () => {
    const { rows } = summarizeCatalog(catalog, now)
    const poe = rows.find((row) => row.concept.id === 'poe-port')

    expect(poe?.cells.find((cell) => cell.platform.id === 'mikrotik-routeros')?.procedure).toBeUndefined()
    expect(poe?.cells.find((cell) => cell.platform.id === 'aruba-aoscx')?.procedure?.task).toBe('poe-port')
  })

  it('flags a runbook for review when it was last reviewed more than 180 days ago', () => {
    // Measured from the newest review, so editing a runbook today does not break the test.
    const newest =
      catalog.procedures
        .map((item) => item.status.reviewed)
        .sort()
        .at(-1) ?? '2026-10-15'
    const halfYearLater = new Date(`${newest}T12:00:00`)
    halfYearLater.setDate(halfYearLater.getDate() + 181)
    const recent = summarizeCatalog(catalog, now)
    const stale = summarizeCatalog(catalog, halfYearLater)

    expect(recent.staleCount).toBe(0)
    expect(stale.staleCount).toBe(stale.total)
    expect(stale.rows[0]?.cells.find((cell) => cell.procedure)?.stale).toBe(true)
  })
})

describe('isPending', () => {
  it('treats every runbook not yet tested on real equipment as pending', () => {
    expect(isPending({ level: 'lab-tested', reviewed: '2026-10-13', firmware: '10.15', notes: 'Lab' })).toBe(false)
    expect(isPending({ level: 'docs-checked', reviewed: '2026-10-13', firmware: '10.15' })).toBe(true)
    expect(isPending({ level: 'unverified', reviewed: '2026-10-13', firmware: '10.15' })).toBe(true)
  })
})
