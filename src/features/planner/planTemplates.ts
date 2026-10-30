import type { PlanVlan } from '../../domain/networkPlan'

export interface PlanTemplate {
  name: string
  description: string
  vlans: PlanVlan[]
}

const vlan = (id: number, name: string, purpose: PlanVlan['purpose']): PlanVlan => ({
  id,
  name,
  purpose,
  subnet: `192.168.${id}.0/24`,
})

/** Usual starting points; the user adapts IDs and networks to the company afterwards. */
export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    name: 'Oficina pequeña',
    description: 'Puestos de trabajo, wifi de invitados separado y una red para administrar los switches.',
    vlans: [vlan(10, 'USUARIOS', 'users'), vlan(40, 'INVITADOS', 'guests'), vlan(99, 'GESTION', 'management')],
  },
  {
    name: 'Oficina con telefonía y cámaras',
    description: 'Añade la telefonía IP y las cámaras en sus propias redes, aisladas de los ordenadores.',
    vlans: [
      vlan(10, 'USUARIOS', 'users'),
      vlan(20, 'VOZ', 'voice'),
      vlan(30, 'CAMARAS', 'cameras'),
      vlan(40, 'INVITADOS', 'guests'),
      vlan(99, 'GESTION', 'management'),
    ],
  },
]
