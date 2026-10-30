import type { Catalog } from '../../domain/buildCatalog'
import { statusHref } from '../../lib/useHashRoute'

/** The most recent review date across runbooks and brand sheets, as an ISO date. */
const latestReview = (catalog: Catalog) =>
  [...catalog.procedures, ...catalog.platforms]
    .map((item) => item.status.reviewed)
    .sort()
    .at(-1)

export function AppFooter({ catalog }: { catalog: Catalog }) {
  return (
    <footer className="shell__footer">
      <span>Versión {__APP_VERSION__}</span>
      <span>Contenido revisado hasta {latestReview(catalog)}</span>
      <a href={statusHref}>Estado del contenido</a>
    </footer>
  )
}
