interface SiteLink {
  label: string
  href: string
  current?: boolean
}

/** The links in VITE_SITE_NAV, or none when the variable is missing or is not a list of { label, href }. */
export function readSiteNav(raw: string | undefined): SiteLink[] {
  if (!raw) return []
  try {
    const links: unknown = JSON.parse(raw)
    if (!Array.isArray(links)) return []
    const valid = links.every(
      (link) => typeof link?.label === 'string' && typeof link?.href === 'string' && link.label && link.href,
    )
    return valid ? (links as SiteLink[]) : []
  } catch {
    return []
  }
}

/** Top bar of the website that embeds the manual; the standalone file is built without it. */
export function SiteNav({ links }: { links: SiteLink[] }) {
  return (
    <div className="site-bar">
      <a className="site-bar__brand" href={links[0]?.href}>
        <span aria-hidden="true">&gt;_</span> sysadmin junior
      </a>
      <nav className="site-bar__nav" aria-label="Secciones de la web">
        {links.map((link) => (
          <a key={link.href} href={link.href} aria-current={link.current ? 'page' : undefined}>
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
