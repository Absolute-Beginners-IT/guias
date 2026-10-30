import type { Catalog } from '../../domain/buildCatalog'
import { type NetworkPlan, orderFromCore, type PlanSwitch } from '../../domain/networkPlan'
import type { Concept, Param, Platform, Procedure } from '../../domain/schema'
import { validateParam } from '../../domain/validateParam'
import { resolveParam, type StepContext } from './resolveParam'

/** Runbooks the planner composes, in the order they are applied on each switch. */
export const PLAN_TASKS = ['vlan-create', 'port-trunk', 'mgmt-ip', 'port-access']

export interface GuideStep {
  key: string
  title: string
  concept: Concept
  procedure: Procedure
  /** Valid values the plan fills; anything else is left for the user. */
  values: Record<string, string>
  /** Required params the user still has to fill, usually the current state of the switch. */
  pending: Param[]
}

export interface SwitchGuide {
  plannedSwitch: PlanSwitch
  platform?: Platform
  steps: GuideStep[]
  notes: string[]
}

/** Sorted, de-duplicated IDs with consecutive runs written as ranges: 1,20,30-32. */
export function compressVlanList(ids: number[]): string {
  const sorted = [...new Set(ids)].sort((a, b) => a - b)
  const parts: string[] = []
  for (let index = 0; index < sorted.length; ) {
    const start = sorted[index] as number
    let end = start
    while (sorted[index + 1] === end + 1) {
      end += 1
      index += 1
    }
    parts.push(start === end ? String(start) : `${start}-${end}`)
    index += 1
  }
  return parts.join(',')
}

function buildStep(
  procedure: Procedure,
  concept: Concept,
  key: string,
  title: string,
  context: StepContext,
): GuideStep {
  const values: Record<string, string> = {}
  for (const param of procedure.params) {
    const value = resolveParam(param, context)?.trim()
    if (value) values[param.id] = value
  }
  // Same rule as the runbook page: a value the runbook would reject is never shown as runnable.
  for (const param of procedure.params) {
    const value = values[param.id]
    if (value !== undefined && validateParam(param, value, values) !== null) delete values[param.id]
  }
  const pending = procedure.params.filter((param) => param.required && values[param.id] === undefined)
  return { key, title, concept, procedure, values, pending }
}

function guideForSwitch(
  plan: NetworkPlan,
  catalog: Catalog,
  plannedSwitch: PlanSwitch,
  parentId: string | undefined,
): SwitchGuide {
  const platform = catalog.platforms.find((item) => item.id === plannedSwitch.platform)
  if (!platform) {
    return { plannedSwitch, steps: [], notes: ['Este modelo no está en el manual, así que no hay pasos para él.'] }
  }

  const notes: string[] = []
  const steps: GuideStep[] = []
  const nameOf = (id: string) => plan.switches.find((item) => item.id === id)?.name ?? id
  const runbook = (task: string) => {
    const procedure = catalog.procedures.find((item) => item.platform === platform.id && item.task === task)
    const concept = catalog.concepts.find((item) => item.id === task)
    if (!procedure || !concept) {
      const missing = `${platform.name} todavía no tiene la guía de «${concept?.title ?? task}».`
      if (!notes.includes(missing)) notes.push(missing)
      return undefined
    }
    return { procedure, concept }
  }
  const base = { switchName: plannedSwitch.name, bridge: plannedSwitch.bridge.trim() || undefined }

  // The link towards the core goes first: it is the one the rest of the network depends on.
  const trunks = plan.links
    .flatMap((link) => {
      if (link.a.switch === plannedSwitch.id) return [{ link, local: link.a, peer: link.b.switch }]
      if (link.b.switch === plannedSwitch.id) return [{ link, local: link.b, peer: link.a.switch }]
      return []
    })
    .sort((first, second) => Number(second.peer === parentId) - Number(first.peer === parentId))
  const trunkPorts = trunks.map((trunk) => trunk.local.interface.trim()).join(',')
  const vlans = [...plan.vlans].sort((a, b) => a.id - b.id)

  const vlanRunbook = runbook('vlan-create')
  const tagsOnCreate = vlanRunbook?.procedure.params.some((param) => param.id === 'trunkPorts') ?? false
  if (vlanRunbook) {
    for (const vlan of vlans) {
      steps.push(
        buildStep(
          vlanRunbook.procedure,
          vlanRunbook.concept,
          `vlan-${vlan.id}`,
          `Crear la VLAN ${vlan.id} (${vlan.name})`,
          {
            ...base,
            change: `vlan-${vlan.id}`,
            vlanId: String(vlan.id),
            vlanName: vlan.name,
            trunkPorts: trunkPorts || undefined,
          },
        ),
      )
    }
  }

  if (tagsOnCreate && trunks.length > 0) {
    notes.push(
      `En ${platform.name} los enlaces quedan etiquetados al crear cada VLAN, así que no hay pasos de trunk aparte.`,
    )
  } else if (trunks.length > 0) {
    const trunkRunbook = runbook('port-trunk')
    if (trunkRunbook) {
      for (const { link, local, peer } of trunks) {
        const iface = local.interface.trim()
        steps.push(
          buildStep(
            trunkRunbook.procedure,
            trunkRunbook.concept,
            `trunk-${link.id}`,
            `Enlace con ${nameOf(peer)}: ${iface} en trunk`,
            {
              ...base,
              change: `trunk-${iface}`,
              interface: iface,
              nativeVlanId: String(link.nativeVlan),
              allowedVlans: compressVlanList([link.nativeVlan, ...vlans.map((vlan) => vlan.id)]),
            },
          ),
        )
      }
    }
  }

  const management = plan.vlans.find((vlan) => vlan.purpose === 'management')
  const mgmtRunbook = runbook('mgmt-ip')
  if (mgmtRunbook) {
    steps.push(
      buildStep(mgmtRunbook.procedure, mgmtRunbook.concept, 'mgmt-ip', `IP de gestión ${plannedSwitch.mgmtIp.trim()}`, {
        ...base,
        change: 'ip-gestion',
        vlanId: management ? String(management.id) : undefined,
        ipCidr: plannedSwitch.mgmtIp.trim(),
        gateway: plannedSwitch.gateway.trim() || undefined,
      }),
    )
  }

  const ports = plan.ports.filter((port) => port.switch === plannedSwitch.id)
  const accessRunbook = ports.length > 0 ? runbook('port-access') : undefined
  if (accessRunbook) {
    for (const port of ports) {
      const iface = port.interface.trim()
      const vlan = plan.vlans.find((item) => item.id === port.vlan)
      steps.push(
        buildStep(
          accessRunbook.procedure,
          accessRunbook.concept,
          `port-${port.id}`,
          `Puerto ${iface} en la VLAN ${port.vlan}${vlan ? ` (${vlan.name})` : ''}`,
          {
            ...base,
            change: `puerto-${iface}`,
            interface: iface,
            vlanId: String(port.vlan),
          },
        ),
      )
    }
  }

  return { plannedSwitch, platform, steps, notes }
}

/** One guide per switch, from the core outwards, composed from the runbooks of each switch's brand. */
export function buildPlanGuide(plan: NetworkPlan, catalog: Catalog): SwitchGuide[] {
  const { order, parent } = orderFromCore(plan)
  return order.flatMap((id) => {
    const plannedSwitch = plan.switches.find((item) => item.id === id)
    return plannedSwitch ? [guideForSwitch(plan, catalog, plannedSwitch, parent.get(id))] : []
  })
}
