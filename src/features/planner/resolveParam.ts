import { prefixToMask } from '../../domain/networkPlan'
import type { Param } from '../../domain/schema'

/** What the plan knows for one step, in brand-neutral terms. */
export interface StepContext {
  switchName: string
  /** Short label for the change, used to name checkpoints and backups. */
  change: string
  interface?: string
  vlanId?: string
  vlanName?: string
  nativeVlanId?: string
  allowedVlans?: string
  trunkPorts?: string
  ipCidr?: string
  gateway?: string
  bridge?: string
}

/** Names the brands give to the port a runbook acts on. */
export const INTERFACE_PARAM_IDS = ['interfaceId', 'interfaceName', 'port']

const DIRECT_IDS = ['vlanId', 'vlanName', 'nativeVlanId', 'allowedVlans', 'trunkPorts', 'ipCidr', 'gateway'] as const

/** Params the planner fills from the plan. */
export const RESOLVED_PARAM_IDS = [
  ...DIRECT_IDS,
  ...INTERFACE_PARAM_IDS,
  'ipAddress',
  'mask',
  'bridgeName',
  'checkpointName',
  'backupName',
  'minutes',
]

/** Params that describe the switch as it is now, or choices only the user can make: left for them on purpose. */
export const USER_PARAM_IDS = [
  'previousVlanId',
  'previousPvid',
  'previousFrameTypes',
  'previousTagged',
  'taggedPorts',
  'dnsServer',
]

const safeName = (text: string, max: number) =>
  text
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '')

/** The value the plan gives to a runbook param, or undefined when the user has to provide it. */
export function resolveParam(param: Param, context: StepContext): string | undefined {
  if (INTERFACE_PARAM_IDS.includes(param.id)) return context.interface
  const [address, prefix] = context.ipCidr?.split('/') ?? []

  switch (param.id) {
    case 'ipAddress':
      return address
    case 'mask':
      return prefix === undefined ? undefined : prefixToMask(Number(prefix))
    case 'bridgeName':
      return context.bridge
    case 'checkpointName':
      return safeName(`antes-${context.change}`, 32)
    case 'backupName':
      return safeName(`${context.switchName}-antes-${context.change}`, 40)
    case 'minutes':
      return param.example
  }
  return (DIRECT_IDS as readonly string[]).includes(param.id)
    ? context[param.id as (typeof DIRECT_IDS)[number]]
    : undefined
}
