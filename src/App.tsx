import { useEffect } from 'react'
import { catalog } from './content/catalog'
import { HomePage } from './features/catalog/HomePage'
import { PlatformPage } from './features/catalog/PlatformPage'
import { FundamentalPage } from './features/fundamentals/FundamentalPage'
import { FundamentalsPage } from './features/fundamentals/FundamentalsPage'
import { AppShell } from './features/navigation/AppShell'
import { describeRunbook, type RunbookHit } from './features/navigation/searchIndex'
import { useRecents } from './features/navigation/useRecents'
import { PlannerPage } from './features/planner/PlannerPage'
import { RunbookPage } from './features/procedure/RunbookPage'
import { StatusPage } from './features/status/StatusPage'
import { type Route, runbookHref, useHashRoute } from './lib/useHashRoute'
import { useStoredState } from './lib/useStoredState'

const findPlatform = (id: string | undefined) => catalog.platforms.find((item) => item.id === id)

function NotFound() {
  return (
    <div>
      <p>No encontramos esa página.</p>
      <a href="#/">Volver al inicio</a>
    </div>
  )
}

interface PageProps {
  route: Route
  recents: RunbookHit[]
  activePlatform: string
}

function Page({ route, recents, activePlatform }: PageProps) {
  if (route.name === 'home') return <HomePage recents={recents} />
  if (route.name === 'not-found') return <NotFound />
  if (route.name === 'fundamentals') return <FundamentalsPage catalog={catalog} />
  if (route.name === 'status') return <StatusPage catalog={catalog} />
  if (route.name === 'plan') return <PlannerPage catalog={catalog} />
  if (route.name === 'fundamental') {
    const article = catalog.fundamentals.find((item) => item.id === route.article)
    return article ? (
      <FundamentalPage key={article.id} catalog={catalog} article={article} activePlatform={activePlatform} />
    ) : (
      <NotFound />
    )
  }

  const platform = findPlatform(route.platform)
  if (!platform) return <NotFound />
  if (route.name === 'platform') return <PlatformPage platform={platform} />

  const concept = catalog.concepts.find((item) => item.id === route.task)
  const procedure = catalog.procedures.find((item) => item.platform === platform.id && item.task === route.task)
  if (!concept || !procedure) return <NotFound />

  const alternatives = catalog.procedures
    .filter((item) => item.task === concept.id && item.platform !== platform.id)
    .flatMap((item) => {
      const other = findPlatform(item.platform)
      return other ? [{ name: other.name, href: runbookHref(other.id, concept.id) }] : []
    })

  // The key resets per-runbook state when the user moves between runbooks.
  return (
    <RunbookPage
      key={`${platform.id}/${concept.id}`}
      platform={platform}
      concept={concept}
      procedure={procedure}
      alternatives={alternatives}
    />
  )
}

export function App() {
  const route = useHashRoute()
  const [lastPlatform, setLastPlatform] = useStoredState('switching-manual:last-platform', '')

  const routePlatform = 'platform' in route ? findPlatform(route.platform)?.id : undefined
  const activePlatform = routePlatform ?? findPlatform(lastPlatform)?.id ?? catalog.platforms[0]?.id ?? ''

  // Pages without a brand in the address, such as the home page, keep showing the last one used.
  useEffect(() => {
    if (routePlatform && routePlatform !== lastPlatform) setLastPlatform(routePlatform)
  }, [routePlatform, lastPlatform, setLastPlatform])

  const [recentKeys, rememberRunbook] = useRecents()
  const openRunbook =
    route.name === 'runbook' && describeRunbook(catalog, route.platform, route.task)
      ? `${route.platform}/${route.task}`
      : undefined

  useEffect(() => {
    if (openRunbook) rememberRunbook(openRunbook)
  }, [openRunbook, rememberRunbook])

  const recents = recentKeys.flatMap((key) => {
    const [platform = '', task = ''] = key.split('/')
    return describeRunbook(catalog, platform, task) ?? []
  })

  return (
    <AppShell catalog={catalog} route={route} activePlatform={activePlatform} recents={recents}>
      <Page route={route} recents={recents} activePlatform={activePlatform} />
    </AppShell>
  )
}
