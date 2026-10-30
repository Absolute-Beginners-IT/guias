import { catalog } from '../../content/catalog'
import type { NetworkPlan } from '../../domain/networkPlan'
import { twoSwitchPlan } from './planFixtures'
import { validatePlan } from './validatePlan'

const messages = (plan: NetworkPlan) => validatePlan(plan, catalog).map((issue) => issue.message)

describe('validatePlan', () => {
  it('accepts a coherent plan', () => {
    expect(validatePlan(twoSwitchPlan(), catalog)).toEqual([])
  })

  it('asks for at least one VLAN and one switch', () => {
    const plan: NetworkPlan = { version: 1, vlans: [], switches: [], links: [], ports: [] }

    expect(messages(plan)).toEqual(expect.arrayContaining(['Añade al menos una VLAN.', 'Añade al menos un switch.']))
  })

  it('rejects a repeated VLAN ID and a name the switches would not accept', () => {
    const plan = twoSwitchPlan()
    plan.vlans.push({ id: 20, name: 'VOZ 2', purpose: 'other', subnet: '' })

    expect(messages(plan)).toEqual(
      expect.arrayContaining([
        'La VLAN 20 está repetida.',
        'El nombre de la VLAN 20 solo admite letras sin tildes, números, guion y guion bajo (máximo 32).',
      ]),
    )
  })

  it('rejects VLAN IDs outside 1 to 4094, on VLANs and on link native VLANs', () => {
    const plan = twoSwitchPlan()
    plan.vlans.push({ id: 0, name: 'MAL', purpose: 'other', subnet: '' })
    const link = plan.links[0]
    if (!link) throw new Error('fixture')
    link.nativeVlan = 4095

    expect(messages(plan)).toEqual(
      expect.arrayContaining([
        'La VLAN 0 no es válida: el ID va de 1 a 4094.',
        'La VLAN nativa del enlace entre nucleo y planta1 tiene que ir de 1 a 4094.',
      ]),
    )
  })

  it('rejects a link native VLAN that is neither VLAN 1 nor a VLAN of the plan', () => {
    const plan = twoSwitchPlan()
    const link = plan.links[0]
    if (!link) throw new Error('fixture')
    link.nativeVlan = 15

    expect(messages(plan)).toContain(
      'La VLAN nativa 15 del enlace entre nucleo y planta1 no está en el plan: usa la 1 o una VLAN del plan.',
    )
  })

  it('accepts VLAN 1 or a VLAN of the plan as link native VLAN', () => {
    const plan = twoSwitchPlan()
    const link = plan.links[0]
    if (!link) throw new Error('fixture')

    link.nativeVlan = 99
    expect(validatePlan(plan, catalog)).toEqual([])
    link.nativeVlan = 1
    expect(validatePlan(plan, catalog)).toEqual([])
  })

  it('needs exactly one management VLAN', () => {
    const none = twoSwitchPlan()
    none.vlans = none.vlans.filter((vlan) => vlan.purpose !== 'management')
    const two = twoSwitchPlan()
    two.vlans.push({ id: 98, name: 'GESTION2', purpose: 'management', subnet: '' })

    expect(messages(none)).toContain('Marca una VLAN con el propósito Gestión.')
    expect(messages(two)).toContain('Solo puede haber una VLAN de gestión.')
  })

  it('checks the management address of each switch', () => {
    const plan = twoSwitchPlan()
    const [core, floor] = plan.switches
    if (!core || !floor) throw new Error('fixture')
    core.mgmtIp = '192.168.99.2'
    floor.mgmtIp = '192.168.50.3/24'

    expect(messages(plan)).toEqual(
      expect.arrayContaining([
        'La IP de gestión de nucleo tiene que llevar prefijo, por ejemplo 192.168.99.11/24.',
        'La IP de gestión de planta1 no está en la red de la VLAN de gestión (192.168.99.0/24).',
      ]),
    )
  })

  it('rejects two switches with the same name or management address', () => {
    const plan = twoSwitchPlan()
    const floor = plan.switches[1]
    if (!floor) throw new Error('fixture')
    floor.name = 'nucleo'
    floor.mgmtIp = '192.168.99.2/24'

    expect(messages(plan)).toEqual(
      expect.arrayContaining([
        'Hay dos switches llamados nucleo.',
        'nucleo y nucleo tienen la misma IP de gestión (192.168.99.2).',
      ]),
    )
  })

  it('checks interface names against the format of each brand', () => {
    const plan = twoSwitchPlan()
    const port = plan.ports[0]
    if (!port) throw new Error('fixture')
    port.interface = '1/1/5'

    expect(messages(plan)).toContain(
      'Puerto 1/1/5 de planta1: Tipo y número en formato unidad/0/puerto, por ejemplo gi1/0/5 o te1/0/1.',
    )
  })

  it('rejects a port used twice on the same switch', () => {
    const plan = twoSwitchPlan()
    plan.ports.push({ id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/48', vlan: 20 })

    expect(messages(plan)).toContain('El puerto gi1/0/48 de planta1 está usado dos veces.')
  })

  it('rejects an access port on a VLAN that is not in the plan', () => {
    const plan = twoSwitchPlan()
    const port = plan.ports[0]
    if (!port) throw new Error('fixture')
    port.vlan = 30

    expect(messages(plan)).toContain('El puerto gi1/0/5 de planta1 usa la VLAN 30, que no está en el plan.')
  })

  it('rejects a link from a switch to itself', () => {
    const plan = twoSwitchPlan()
    plan.links.push({
      id: 'ln-2',
      a: { switch: 'sw-2', interface: 'gi1/0/1' },
      b: { switch: 'sw-2', interface: 'gi1/0/2' },
      nativeVlan: 1,
    })

    expect(messages(plan)).toContain('Un enlace no puede unir planta1 consigo mismo.')
  })

  it('warns when a switch has no path to the first one', () => {
    const plan = twoSwitchPlan()
    plan.links = []
    plan.ports = []

    expect(messages(plan)).toContain('planta1 no tiene enlace con nucleo: la VLAN de gestión no le llegaría.')
  })

  it('rejects repeated switch, link and port ids from a hand-edited file', () => {
    const plan = twoSwitchPlan()
    plan.switches.push({
      id: 'sw-2',
      name: 'planta2',
      platform: 'cisco-c1300',
      mgmtIp: '192.168.99.4/24',
      gateway: '192.168.99.1',
      bridge: '',
    })
    plan.links.push({
      id: 'ln-1',
      a: { switch: 'sw-1', interface: '1/1/50' },
      b: { switch: 'sw-2', interface: 'gi1/0/47' },
      nativeVlan: 1,
    })
    plan.ports.push({ id: 'pt-1', switch: 'sw-2', interface: 'gi1/0/6', vlan: 10 })

    expect(messages(plan)).toEqual(
      expect.arrayContaining([
        'El archivo del plan tiene dos switches con el mismo identificador (sw-2).',
        'El archivo del plan tiene dos enlaces con el mismo identificador (ln-1).',
        'El archivo del plan tiene dos puertos con el mismo identificador (pt-1).',
      ]),
    )
  })

  it('rejects a model that is not in the manual', () => {
    const plan = twoSwitchPlan()
    const floor = plan.switches[1]
    if (!floor) throw new Error('fixture')
    floor.platform = 'otro'

    expect(messages(plan)).toContain('Elige el modelo de planta1 entre los del manual.')
  })
})
