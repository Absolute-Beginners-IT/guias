import type { NetworkPlan } from '../../domain/networkPlan'

/** An Aruba core with a Cisco floor switch behind it: the smallest plan that exercises every step. */
export const twoSwitchPlan = (): NetworkPlan => ({
  version: 1,
  vlans: [
    { id: 10, name: 'USUARIOS', purpose: 'users', subnet: '192.168.10.0/24' },
    { id: 20, name: 'VOZ', purpose: 'voice', subnet: '' },
    { id: 99, name: 'GESTION', purpose: 'management', subnet: '192.168.99.0/24' },
  ],
  switches: [
    {
      id: 'sw-1',
      name: 'nucleo',
      platform: 'aruba-aoscx',
      mgmtIp: '192.168.99.2/24',
      gateway: '192.168.99.1',
      bridge: '',
    },
    {
      id: 'sw-2',
      name: 'planta1',
      platform: 'cisco-c1300',
      mgmtIp: '192.168.99.3/24',
      gateway: '192.168.99.1',
      bridge: '',
    },
  ],
  links: [
    {
      id: 'ln-1',
      a: { switch: 'sw-1', interface: '1/1/49' },
      b: { switch: 'sw-2', interface: 'gi1/0/48' },
      nativeVlan: 1,
    },
  ],
  ports: [{ id: 'pt-1', switch: 'sw-2', interface: 'gi1/0/5', vlan: 10 }],
})
