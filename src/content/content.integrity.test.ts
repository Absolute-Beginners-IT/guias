import { catalog } from './catalog'

// Validation itself happens while the catalog is built; these checks pin what the manual must contain.
describe('content catalog', () => {
  it('loads without schema or reference errors', () => {
    expect(catalog.platforms.length).toBeGreaterThan(0)
    expect(catalog.concepts.length).toBeGreaterThan(0)
    expect(catalog.procedures.length).toBeGreaterThan(0)
  })

  it('covers the four platforms used at the company', () => {
    const ids = catalog.platforms.map((item) => item.id)

    expect(new Set(ids)).toEqual(new Set(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee']))
  })

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee'])(
    'has config backup and restore runbooks for %s, since every rollback relies on them',
    (platform) => {
      const tasks = catalog.procedures.filter((item) => item.platform === platform).map((item) => item.task)

      expect(tasks).toEqual(expect.arrayContaining(['config-backup', 'config-restore']))
    },
  )

  it('rates every restore runbook as high risk', () => {
    const restores = catalog.procedures.filter((item) => item.task === 'config-restore')

    expect(restores.map((item) => item.risk.level)).toEqual(restores.map(() => 'high'))
  })

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee'])(
    'includes the VLAN creation runbook for %s',
    (platform) => {
      const runbook = catalog.procedures.find((item) => item.platform === platform && item.task === 'vlan-create')

      expect(runbook).toBeDefined()
    },
  )

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee'])(
    'has access port and trunk port runbooks for %s',
    (platform) => {
      const tasks = catalog.procedures.filter((item) => item.platform === platform).map((item) => item.task)

      expect(tasks).toEqual(expect.arrayContaining(['port-access', 'port-trunk']))
    },
  )

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee'])(
    'has a link aggregation runbook for %s',
    (platform) => {
      const runbook = catalog.procedures.find((item) => item.platform === platform && item.task === 'lag-create')

      expect(runbook?.risk.level).toBe('high')
    },
  )

  it('has a PoE runbook only for the platforms that supply PoE', () => {
    const platforms = catalog.procedures.filter((item) => item.task === 'poe-port').map((item) => item.platform)

    expect(new Set(platforms)).toEqual(new Set(['aruba-aoscx', 'cisco-c1300', 'ruijie-reyee']))
  })

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee'])(
    'has a management IP runbook for %s, rated high risk because it can cut the session in use',
    (platform) => {
      const runbook = catalog.procedures.find((item) => item.platform === platform && item.task === 'mgmt-ip')

      expect(runbook?.risk.level).toBe('high')
    },
  )

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros'])(
    'has admin user, SSH access and firmware upgrade runbooks for %s',
    (platform) => {
      const tasks = catalog.procedures.filter((item) => item.platform === platform).map((item) => item.task)

      expect(tasks).toEqual(expect.arrayContaining(['user-admin', 'ssh-access', 'firmware-upgrade']))
    },
  )

  it('has a firmware upgrade runbook for the web-managed Ruijie, which has no CLI users or SSH to configure', () => {
    const tasks = catalog.procedures.filter((item) => item.platform === 'ruijie-reyee').map((item) => item.task)

    expect(tasks).toContain('firmware-upgrade')
  })

  it('only offers screen steps, never commands, on platforms managed from their web interface', () => {
    const webPlatforms = new Set(catalog.platforms.filter((item) => item.management === 'web').map((item) => item.id))
    const withCommands = catalog.procedures
      .filter((item) => webPlatforms.has(item.platform))
      .filter(
        (item) =>
          item.steps.some((step) => step.commands.length > 0) ||
          item.rollback.steps.some((step) => step.commands.length > 0) ||
          item.verification.some((check) => check.command) ||
          item.preflight.some((check) => check.command),
      )
      .map((item) => `${item.platform}/${item.task}`)

    expect(withCommands).toEqual([])
  })

  it('rates every firmware upgrade as high risk, since it reboots the switch', () => {
    const upgrades = catalog.procedures.filter((item) => item.task === 'firmware-upgrade')

    expect(upgrades.map((item) => item.risk.level)).toEqual(upgrades.map(() => 'high'))
  })

  it('asks for passwords only as secret values, because the other values are stored in the browser', () => {
    const secretLike = /pass|contrase|secret|clave|communit|comunidad/i
    const offenders = catalog.procedures.flatMap((item) =>
      item.params
        .filter((param) => param.type !== 'secret')
        .filter((param) => secretLike.test(param.id) || secretLike.test(param.label))
        .map((param) => `${item.platform}/${item.task}: ${param.id}`),
    )

    expect(offenders).toEqual([])
  })

  it('does not let the Aruba firmware runbook install over the image kept as fallback', () => {
    const upgrade = catalog.procedures.find(
      (item) => item.platform === 'aruba-aoscx' && item.task === 'firmware-upgrade',
    )
    const target = upgrade?.params.find((param) => param.id === 'targetImage')

    expect(target?.differentFrom?.param).toBe('fallbackImage')
  })

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee'])(
    'has NTP, remote syslog, SNMP and LLDP runbooks for %s',
    (platform) => {
      const tasks = catalog.procedures.filter((item) => item.platform === platform).map((item) => item.task)

      expect(tasks).toEqual(
        expect.arrayContaining(['ntp-client', 'syslog-remote', 'snmp-monitoring', 'lldp-neighbors']),
      )
    },
  )

  it('never rates an SNMP runbook as low risk, since a wrong community or address exposes the switch', () => {
    const snmp = catalog.procedures.filter((item) => item.task === 'snmp-monitoring')

    expect(snmp.filter((item) => item.risk.level === 'low')).toEqual([])
  })

  it.each([
    ['aruba-aoscx', 'priv aes'],
    ['mikrotik-routeros', 'security=private'],
  ])('configures SNMPv3 with authentication and encryption on %s', (platform, authPrivMarker) => {
    const runbook = catalog.procedures.find((item) => item.platform === platform && item.task === 'snmp-monitoring')

    expect(JSON.stringify(runbook?.steps)).toContain(authPrivMarker)
  })

  it.each([
    [
      'aruba-aoscx',
      'snmpv3 user {{snmpUser}} auth sha auth-pass plaintext {{authKey}} priv aes priv-pass plaintext {{privKey}}',
    ],
    ['mikrotik-routeros', 'authentication-password={{authKey}} encryption-password={{privKey}}'],
  ])('gives the full SNMPv3 user command on %s, with the keys as secret values', (platform, command) => {
    const runbook = catalog.procedures.find((item) => item.platform === platform && item.task === 'snmp-monitoring')
    const keys = runbook?.params.filter((param) => param.id === 'authKey' || param.id === 'privKey')

    expect(runbook?.steps.flatMap((step) => step.commands).some((line) => line.includes(command))).toBe(true)
    expect(keys?.map((param) => param.type)).toEqual(['secret', 'secret'])
    expect(runbook?.params.find((param) => param.id === 'privKey')?.differentFrom?.param).toBe('authKey')
  })

  it('never rates a trunk change as low risk, since a trunk carries several VLANs at once', () => {
    const trunks = catalog.procedures.filter((item) => item.task === 'port-trunk')

    expect(trunks.filter((item) => item.risk.level === 'low')).toEqual([])
  })

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee'])(
    'has Spanning Tree, DHCP snooping and management ACL runbooks for %s',
    (platform) => {
      const tasks = catalog.procedures.filter((item) => item.platform === platform).map((item) => item.task)

      expect(tasks).toEqual(expect.arrayContaining(['stp-edge-protection', 'dhcp-snooping', 'mgmt-acl']))
    },
  )

  it('has a port security runbook only for the platforms that can limit MAC addresses per port', () => {
    const platforms = catalog.procedures.filter((item) => item.task === 'port-security').map((item) => item.platform)

    expect(new Set(platforms)).toEqual(new Set(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros']))
  })

  it('rates every management ACL as high risk, since a missing rule locks the administrator out', () => {
    const acls = catalog.procedures.filter((item) => item.task === 'mgmt-acl')

    expect(acls.filter((item) => item.risk.level !== 'high')).toEqual([])
  })

  it.each([
    ['dhcp-snooping', 'a wrong trusted port leaves a whole VLAN without addresses'],
    ['port-security', 'a limit too low or a wrong port cuts legitimate devices'],
    ['stp-edge-protection', 'an edge port on a switch link removes loop protection'],
  ])('never rates %s as low risk, since %s', (task) => {
    const runbooks = catalog.procedures.filter((item) => item.task === task)

    expect(runbooks.filter((item) => item.risk.level === 'low')).toEqual([])
  })

  it('never marks a runbook as lab-tested without a note saying where it was tested', () => {
    const untraceable = catalog.procedures.filter((item) => item.status.level === 'lab-tested' && !item.status.notes)

    expect(untraceable).toEqual([])
  })

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee'])(
    'takes SNMP on %s from enabling the agent to an SNMPv3 user with SHA and AES',
    (platform) => {
      const runbook = catalog.procedures.find((item) => item.platform === platform && item.task === 'snmp-monitoring')
      const text = (runbook?.steps ?? [])
        // The schema defaults commands to [], but the guard keeps the test independent of that default.
        .flatMap((step) => [step.title ?? '', step.explanation, ...(step.commands ?? [])])
        .join('\n')

      expect(text).toMatch(/SNMPv3|\bv3\b/)
      expect(text).toMatch(/\bSHA/)
      expect(text).toMatch(/\bAES|\baes/)
    },
  )
})
