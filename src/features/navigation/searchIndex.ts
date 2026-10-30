import MiniSearch from 'minisearch'
import type { Catalog } from '../../domain/buildCatalog'
import { fundamentalsHref, runbookHref } from '../../lib/useHashRoute'
import { GROUP_LABELS } from '../labels'

/** What the user needs to recognise a runbook in a list. */
export interface RunbookHit {
  platform: string
  task: string
  title: string
  platformName: string
  groupLabel: string
}

/** One result of the quick search: a runbook or a fundamentals article. */
export interface SearchHit {
  href: string
  title: string
  /** Second line, such as the brand and group of a runbook. */
  detail: string
}

export const runbookSearchHit = (hit: RunbookHit): SearchHit => ({
  href: runbookHref(hit.platform, hit.task),
  title: hit.title,
  detail: `${hit.platformName} · ${hit.groupLabel}`,
})

const DIACRITICS = /\p{Diacritic}/gu
// Lets "gestion" find "gestión": people type fast and without accents when they are working.
const normalize = (term: string) => term.toLowerCase().normalize('NFD').replace(DIACRITICS, '')

export function describeRunbook(catalog: Catalog, platformId: string, taskId: string): RunbookHit | undefined {
  const platform = catalog.platforms.find((item) => item.id === platformId)
  const concept = catalog.concepts.find((item) => item.id === taskId)
  const exists = catalog.procedures.some((item) => item.platform === platformId && item.task === taskId)
  if (!platform || !concept || !exists) return undefined

  return {
    platform: platform.id,
    task: concept.id,
    title: concept.title,
    platformName: platform.name,
    groupLabel: GROUP_LABELS[concept.group],
  }
}

export function buildSearchIndex(catalog: Catalog): (query: string) => SearchHit[] {
  const hits = new Map<string, SearchHit>()
  const index = new MiniSearch({
    fields: ['title', 'platform', 'group', 'summary', 'commands', 'body'],
    processTerm: normalize,
    searchOptions: { prefix: true, combineWith: 'AND', boost: { title: 3, platform: 2 } },
  })

  for (const procedure of catalog.procedures) {
    const runbook = describeRunbook(catalog, procedure.platform, procedure.task)
    const platform = catalog.platforms.find((item) => item.id === procedure.platform)
    if (!runbook || !platform) continue

    const hit = runbookSearchHit(runbook)
    hits.set(hit.href, hit)
    index.add({
      id: hit.href,
      title: runbook.title,
      platform: `${platform.vendor} ${platform.name} ${platform.os}`,
      group: runbook.groupLabel,
      summary: procedure.summary,
      commands: [...procedure.steps, ...procedure.rollback.steps].flatMap((step) => step.commands).join(' '),
    })
  }

  for (const article of catalog.fundamentals) {
    const hit = { href: fundamentalsHref(article.id), title: article.title, detail: 'Fundamentos' }
    hits.set(hit.href, hit)
    index.add({
      id: hit.href,
      title: article.title,
      group: hit.detail,
      summary: article.summary,
      body: article.sections
        .flatMap((section) => [section.heading, ...section.paragraphs, ...section.points])
        .join(' '),
    })
  }

  return (query) => {
    if (query.trim() === '') return []
    return index.search(query).flatMap((result) => hits.get(String(result.id)) ?? [])
  }
}
