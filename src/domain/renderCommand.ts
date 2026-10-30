const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g

export type ParamValues = Record<string, string | undefined>

/** Fills `{{id}}` placeholders; unfilled ones stay visible as `<id>` so they are never run by mistake. */
export function renderCommand(template: string, values: ParamValues): string {
  return template.replace(PLACEHOLDER, (_match, id: string) => {
    const value = values[id]?.trim()
    return value ? value : `<${id}>`
  })
}

export function extractParamIds(template: string): string[] {
  const ids = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER)) {
    if (match[1]) ids.add(match[1])
  }
  return [...ids]
}
