import type { Catalog } from '../../domain/buildCatalog'
import { fundamentalsHref, platformHref } from '../../lib/useHashRoute'
import { Section } from '../../ui/Section'

const MANAGEMENT_LABELS = { cli: 'Línea de comandos', web: 'Interfaz web' } as const

/** Entry point of the background reading, with the brands of this manual side by side. */
export function FundamentalsPage({ catalog }: { catalog: Catalog }) {
  return (
    <div>
      <header className="page-header">
        <h1>Fundamentos</h1>
        <p className="lead">
          Qué es un switch, para qué sirve, qué puede hacer y qué marcas hay. Léelos en orden si empiezas de cero; cada
          artículo enlaza con las guías que lo ponen en práctica.
        </p>
      </header>

      <Section title="Artículos">
        <ol className="plain-list">
          {catalog.fundamentals.map((article) => (
            <li key={article.id}>
              <h3>
                <a href={fundamentalsHref(article.id)}>{article.title}</a>
              </h3>
              <p>{article.summary}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Marcas de este manual">
        <table aria-label="Marcas de este manual">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Fabricante</th>
              <th>Sistema</th>
              <th>Gestión en las guías</th>
            </tr>
          </thead>
          <tbody>
            {catalog.platforms.map((platform) => (
              <tr key={platform.id}>
                <td>
                  <a href={platformHref(platform.id)}>{platform.name}</a>
                </td>
                <td>{platform.vendor}</td>
                <td>{platform.os}</td>
                <td>{MANAGEMENT_LABELS[platform.management]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  )
}
