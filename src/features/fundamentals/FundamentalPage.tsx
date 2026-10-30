import type { Catalog } from '../../domain/buildCatalog'
import type { Fundamental } from '../../domain/schema'
import { fundamentalsHref, runbookHref } from '../../lib/useHashRoute'
import { Section } from '../../ui/Section'

interface FundamentalPageProps {
  catalog: Catalog
  article: Fundamental
  /** Brand in use, preferred when linking to a runbook. */
  activePlatform: string
}

export function FundamentalPage({ catalog, article, activePlatform }: FundamentalPageProps) {
  const position = catalog.fundamentals.findIndex((item) => item.id === article.id)
  const next = catalog.fundamentals[position + 1]

  // A task links to the brand in use when it has that runbook, otherwise to the first brand that does.
  const related = article.related.flatMap((task) => {
    const concept = catalog.concepts.find((item) => item.id === task)
    const runbooks = catalog.procedures.filter((item) => item.task === task)
    const runbook = runbooks.find((item) => item.platform === activePlatform) ?? runbooks[0]
    return concept && runbook ? [{ title: concept.title, href: runbookHref(runbook.platform, task) }] : []
  })

  return (
    <article>
      <header className="page-header">
        <p className="eyebrow">Fundamentos</p>
        <h1>{article.title}</h1>
        <p className="lead">{article.summary}</p>
      </header>

      {article.sections.map((section) => (
        <Section key={section.heading} title={section.heading}>
          {section.paragraphs.map((paragraph, index) => (
            // Content is static, so the position is a stable key even if two paragraphs read the same.
            <p key={index}>{paragraph}</p>
          ))}
          {section.points.length > 0 && (
            <ul>
              {section.points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          )}
        </Section>
      ))}

      {related.length > 0 && (
        <Section title="Para ponerlo en práctica">
          <nav aria-label="Guías relacionadas">
            <ul>
              {related.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        </Section>
      )}

      {next && (
        <p className="next-article">
          Siguiente: <a href={fundamentalsHref(next.id)}>{next.title}</a>
        </p>
      )}
    </article>
  )
}
