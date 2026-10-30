import { buildCatalog } from '../domain/buildCatalog'

const files = import.meta.glob<string>('./**/*.yaml', { query: '?raw', import: 'default', eager: true })

// Keys are normalized to the `/content/<folder>/...` shape buildCatalog expects.
export const catalog = buildCatalog(
  Object.fromEntries(Object.entries(files).map(([path, source]) => [path.replace(/^\./, '/content'), source])),
)
