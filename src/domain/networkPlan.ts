import { z } from 'zod'

export const VLAN_PURPOSES = ['users', 'voice', 'servers', 'guests', 'cameras', 'management', 'iot', 'other'] as const

// Range is checked by validatePlan, so a half-typed ID never makes the stored plan unreadable.
const vlanId = z.number().int()

// Fields stay loose strings: the planner checks them with messages the user can act on (validatePlan),
// while this schema only guards the shape of a stored or imported plan.
export const PlanVlanSchema = z.object({
  id: vlanId,
  name: z.string(),
  purpose: z.enum(VLAN_PURPOSES),
  subnet: z.string().default(''),
})

export const PlanSwitchSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  /** Id of a platform of the catalog. */
  platform: z.string(),
  /** Management address with its prefix, such as 192.168.99.2/24. */
  mgmtIp: z.string().default(''),
  gateway: z.string().default(''),
  /** Bridge that holds the ports, for brands that model VLANs on a bridge (MikroTik). */
  bridge: z.string().default(''),
})

const EndpointSchema = z.object({ switch: z.string(), interface: z.string() })

export const PlanLinkSchema = z.object({
  id: z.string().min(1),
  a: EndpointSchema,
  b: EndpointSchema,
  // One value for the whole link, so both ends can never disagree.
  nativeVlan: vlanId.default(1),
})

export const PlanPortSchema = z.object({
  id: z.string().min(1),
  switch: z.string(),
  interface: z.string(),
  vlan: vlanId,
})

export const NetworkPlanSchema = z.object({
  version: z.literal(1),
  vlans: z.array(PlanVlanSchema),
  /** The first switch is the core: the guide starts there and works outwards. */
  switches: z.array(PlanSwitchSchema),
  links: z.array(PlanLinkSchema),
  ports: z.array(PlanPortSchema),
})

export type VlanPurpose = (typeof VLAN_PURPOSES)[number]
export type PlanVlan = z.infer<typeof PlanVlanSchema>
export type PlanSwitch = z.infer<typeof PlanSwitchSchema>
export type PlanLink = z.infer<typeof PlanLinkSchema>
export type PlanPort = z.infer<typeof PlanPortSchema>
export type NetworkPlan = z.infer<typeof NetworkPlanSchema>

export const EMPTY_PLAN: NetworkPlan = { version: 1, vlans: [], switches: [], links: [], ports: [] }

/** Switch ids in the order they are configured: breadth-first from the first switch, unreachable ones last. */
export function orderFromCore(plan: NetworkPlan): { order: string[]; parent: Map<string, string> } {
  const known = new Set(plan.switches.map((item) => item.id))
  const parent = new Map<string, string>()
  const [core] = plan.switches
  const order: string[] = []
  if (!core) return { order, parent }

  const seen = new Set([core.id])
  const queue = [core.id]
  while (queue.length > 0) {
    const current = queue.shift() as string
    order.push(current)
    for (const link of plan.links) {
      const peer = link.a.switch === current ? link.b.switch : link.b.switch === current ? link.a.switch : undefined
      if (peer === undefined || seen.has(peer) || !known.has(peer)) continue
      seen.add(peer)
      parent.set(peer, current)
      queue.push(peer)
    }
  }
  for (const item of plan.switches) if (!seen.has(item.id)) order.push(item.id)
  return { order, parent }
}

const toNumber = (address: string) => address.split('.').reduce((total, octet) => total * 256 + Number(octet), 0)

/** Whether an IPv4 address belongs to a network given in CIDR form. Both must already be valid. */
export function inSubnet(address: string, network: string): boolean {
  const [base = '', prefixText = '0'] = network.split('/')
  const prefix = Number(prefixText)
  const size = 2 ** (32 - prefix)
  return Math.floor(toNumber(address) / size) === Math.floor(toNumber(base) / size)
}

/** Dotted mask for a prefix length, such as 255.255.255.0 for 24. */
export function prefixToMask(prefix: number): string {
  const bits = '1'.repeat(prefix).padEnd(32, '0')
  return [0, 8, 16, 24].map((start) => Number.parseInt(bits.slice(start, start + 8), 2)).join('.')
}
