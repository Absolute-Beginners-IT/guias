import { EMPTY_PLAN, type NetworkPlan, NetworkPlanSchema } from '../../domain/networkPlan'
import { useStoredState } from '../../lib/useStoredState'

export const PLAN_STORAGE_KEY = 'switching-manual:plan'

/** Reads a plan from untrusted JSON (storage or an imported file); null when it does not have the right shape. */
export function parsePlan(value: unknown): NetworkPlan | null {
  const result = NetworkPlanSchema.safeParse(value)
  return result.success ? result.data : null
}

/** The plan being edited, kept in this browser. A stored plan with the wrong shape starts again empty. */
export function usePlan(): [NetworkPlan, (plan: NetworkPlan) => void] {
  const [stored, setPlan] = useStoredState<unknown>(PLAN_STORAGE_KEY, EMPTY_PLAN)
  return [parsePlan(stored) ?? EMPTY_PLAN, setPlan]
}

/** A short id not used yet by any item of the list, such as sw-3. */
export function nextId(prefix: string, items: { id: string }[]): string {
  const taken = new Set(items.map((item) => item.id))
  let number = items.length + 1
  while (taken.has(`${prefix}-${number}`)) number += 1
  return `${prefix}-${number}`
}
