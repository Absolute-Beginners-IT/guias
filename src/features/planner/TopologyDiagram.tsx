import { useLayoutEffect, useRef, useState } from 'react'
import type { Catalog } from '../../domain/buildCatalog'
import { type NetworkPlan, orderFromCore, type VlanPurpose } from '../../domain/networkPlan'

const NODE_WIDTH = 190
const NODE_HEIGHT = 84
const GAP_X = 36
const GAP_Y = 72
const MARGIN = 20
// Fallback when the browser cannot measure text: characters that usually fit on the card at its font size.
const NAME_MAX = 20
const NAME_X = 12
// Room for the name between the left and right padding of the card.
const NAME_ROOM = NODE_WIDTH - NAME_X * 2

// Mid-tone hues that keep their contrast on both the light and the dark surface.
export const PURPOSE_COLORS: Record<VlanPurpose, string> = {
  users: '#3b82f6',
  voice: '#10b981',
  servers: '#8b5cf6',
  guests: '#f59e0b',
  cameras: '#ef4444',
  management: '#64748b',
  iot: '#06b6d4',
  other: '#ec4899',
}

const shorten = (name: string) => (name.length > NAME_MAX ? `${name.slice(0, NAME_MAX)}…` : name)

/**
 * The longest start of the name, with an ellipsis, that fits the room. It writes candidates into a hidden text
 * element React leaves empty, never into the visible one, so React's view of the visible text stays true.
 */
function fitToWidth(element: SVGTextElement, name: string): string {
  const widthOf = (text: string) => {
    element.textContent = text
    return element.getComputedTextLength()
  }
  if (widthOf(name) <= NAME_ROOM) {
    element.textContent = ''
    return name
  }
  let low = 0
  let high = name.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (widthOf(`${name.slice(0, middle)}…`) <= NAME_ROOM) low = middle
    else high = middle - 1
  }
  element.textContent = ''
  return `${name.slice(0, low)}…`
}

/** A switch name that never runs past its card: measured when the browser can, by characters otherwise. */
function NodeName({ name }: { name: string }) {
  const measureRef = useRef<SVGTextElement>(null)
  const [shown, setShown] = useState(() => shorten(name))

  useLayoutEffect(() => {
    const element = measureRef.current
    // jsdom and very old engines have no text layout; the character rule above stays in place there.
    const measurable = element !== null && typeof element.getComputedTextLength === 'function'
    setShown(measurable ? fitToWidth(element, name) : shorten(name))
  }, [name])

  return (
    <g>
      {shown !== name && <title>{name}</title>}
      <text x={NAME_X} y={22} className="topology__name">
        {shown}
      </text>
      {/* Same font as the name, only to measure candidates; hidden elements stay out of the accessibility tree. */}
      <text ref={measureRef} x={NAME_X} y={22} className="topology__name" visibility="hidden" />
    </g>
  )
}

interface Placed {
  id: string
  x: number
  y: number
  reachable: boolean
}

/** Rows by distance to the core; switches without a path to it go in a last row of their own. */
function layout(plan: NetworkPlan): { placed: Map<string, Placed>; width: number; height: number } {
  const { order, parent } = orderFromCore(plan)
  const core = plan.switches[0]?.id
  const depth = new Map<string, number>()
  const rows: string[][] = []
  for (const id of order) {
    const parentId = parent.get(id)
    const reachable = id === core || parentId !== undefined
    const level = id === core ? 0 : parentId !== undefined ? (depth.get(parentId) ?? 0) + 1 : -1
    depth.set(id, level)
    if (reachable) rows[level] = [...(rows[level] ?? []), id]
  }
  const unreachable = order.filter((id) => depth.get(id) === -1)
  if (unreachable.length > 0) rows.push(unreachable)

  const widest = Math.max(1, ...rows.map((row) => row.length))
  const width = MARGIN * 2 + widest * NODE_WIDTH + (widest - 1) * GAP_X
  const placed = new Map<string, Placed>()
  rows.forEach((row, rowIndex) => {
    const rowWidth = row.length * NODE_WIDTH + (row.length - 1) * GAP_X
    const start = (width - rowWidth) / 2
    row.forEach((id, column) => {
      placed.set(id, {
        id,
        x: start + column * (NODE_WIDTH + GAP_X),
        y: MARGIN + rowIndex * (NODE_HEIGHT + GAP_Y),
        reachable: depth.get(id) !== -1,
      })
    })
  })
  return { placed, width, height: MARGIN * 2 + rows.length * NODE_HEIGHT + Math.max(0, rows.length - 1) * GAP_Y }
}

/** A read-only drawing of the plan: switches by distance to the core, links with their ports, VLANs by colour. */
export function TopologyDiagram({ plan, catalog }: { plan: NetworkPlan; catalog: Catalog }) {
  const { placed, width, height } = layout(plan)
  const switchById = new Map(plan.switches.map((item) => [item.id, item]))
  const modelOf = (platform: string) =>
    catalog.platforms.find((item) => item.id === platform)?.name ?? 'modelo sin elegir'
  const nameOf = (id: string) => switchById.get(id)?.name.trim() || 'sin nombre'
  const describe = (id: string) => `${nameOf(id)} (${modelOf(switchById.get(id)?.platform ?? '')})`

  const links = plan.links.filter((link) => placed.has(link.a.switch) && placed.has(link.b.switch))
  const summary =
    links.length > 0
      ? links
          .map(
            (link) =>
              `${describe(link.a.switch)} unido a ${describe(link.b.switch)} por ${link.a.interface.trim() || '?'} y ${link.b.interface.trim() || '?'}`,
          )
          .join('; ')
      : plan.switches.map((item) => describe(item.id)).join(', ')

  return (
    <div className="topology">
      <div className="topology__canvas">
        <svg
          role="img"
          aria-label={`Mapa de la red: ${summary}`}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
        >
          {links.map((link) => {
            const a = placed.get(link.a.switch) as Placed
            const b = placed.get(link.b.switch) as Placed
            const [top, bottom, topPort, bottomPort] =
              a.y <= b.y ? [a, b, link.a.interface, link.b.interface] : [b, a, link.b.interface, link.a.interface]
            const sameRow = top.y === bottom.y
            const x1 = top.x + NODE_WIDTH / 2
            const y1 = sameRow ? top.y + NODE_HEIGHT / 2 : top.y + NODE_HEIGHT
            const x2 = bottom.x + NODE_WIDTH / 2
            const y2 = sameRow ? bottom.y + NODE_HEIGHT / 2 : bottom.y
            const at = (share: number) => ({ x: x1 + (x2 - x1) * share, y: y1 + (y2 - y1) * share })
            const near = at(0.25)
            const far = at(0.78)
            // Labels sit on the outer side of the line, so two links leaving the same switch never overlap.
            const leftward = x2 < x1
            const anchor = leftward ? 'end' : 'start'
            const offset = leftward ? -8 : 8
            return (
              <g key={link.id} className="topology__link">
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
                <text x={near.x + offset} y={near.y} textAnchor={anchor}>
                  {topPort.trim()}
                </text>
                <text x={far.x + offset} y={far.y} textAnchor={anchor}>
                  {bottomPort.trim()}
                </text>
              </g>
            )
          })}
          {plan.switches.map((item, index) => {
            const node = placed.get(item.id)
            if (!node) return null
            const vlans = [...new Set(plan.ports.filter((port) => port.switch === item.id).map((port) => port.vlan))]
              .map((id) => plan.vlans.find((vlan) => vlan.id === id))
              .filter((vlan) => vlan !== undefined)
            return (
              <g
                key={item.id}
                className={node.reachable ? 'topology__node' : 'topology__node topology__node--alone'}
                transform={`translate(${node.x} ${node.y})`}
              >
                <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx={10} />
                <NodeName name={nameOf(item.id)} />
                {/* On the bottom line, where it never meets the name; the core always has a path, so no "Sin enlace" there. */}
                {index === 0 && (
                  <text x={12} y={76} className="topology__core">
                    Núcleo
                  </text>
                )}
                <text x={12} y={42} className="topology__meta">
                  {modelOf(item.platform)}
                </text>
                <text x={12} y={60} className="topology__meta">
                  {item.mgmtIp.trim() || 'IP sin definir'}
                </text>
                {!node.reachable && (
                  <text x={12} y={76} className="topology__alone">
                    Sin enlace
                  </text>
                )}
                {vlans.map((vlan, position) => (
                  <circle
                    key={vlan.id}
                    cx={NODE_WIDTH - 14 - position * 14}
                    cy={NODE_HEIGHT - 14}
                    r={5}
                    fill={PURPOSE_COLORS[vlan.purpose]}
                  >
                    <title>{`Puertos en la VLAN ${vlan.id} ${vlan.name}`}</title>
                  </circle>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      {plan.vlans.length > 0 && (
        <ul className="topology__legend" aria-label="Leyenda de VLAN">
          {plan.vlans.map((vlan, index) => (
            <li key={index}>
              <span className="topology__swatch" style={{ background: PURPOSE_COLORS[vlan.purpose] }} />
              {vlan.id} {vlan.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
