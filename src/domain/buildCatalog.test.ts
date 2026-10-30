import { buildCatalog } from './buildCatalog'

const platform = `
id: aruba-aoscx
vendor: HPE Aruba Networking
name: Aruba 6100
os: AOS-CX
models: [6100 48G 4SFP+]
summary: Switch de acceso de capa 2.
cliModes:
  - { name: Manager, prompt: 'switch#', enter: Al iniciar sesión, description: Comandos de consulta. }
configPersistence: La configuración en ejecución se guarda con write memory.
safetyNets:
  - { name: Checkpoints, description: Copias con nombre de la configuración. }
sources:
  - { title: Guía, url: 'https://example.com/guide' }
status: { level: docs-checked, reviewed: '2026-10-13', firmware: '10.15' }
`

const concept = `
id: vlan-create
title: Crear una VLAN
group: vlans-ports
summary: Crea una VLAN.
explanation: Una VLAN separa el tráfico.
risks: [Usar un ID ya existente.]
order: 1
`

const procedure = `
platform: aruba-aoscx
task: vlan-create
summary: Crea una VLAN.
risk: { level: low, reason: No afecta al tráfico existente. }
params:
  - { id: vlanId, label: ID de VLAN, type: vlan-id, example: '20' }
preflight:
  - { text: Revisa las VLAN existentes., command: show vlan }
steps:
  - { title: Crear, commands: ['vlan {{vlanId}}'], explanation: Crea la VLAN. }
verification:
  - { command: 'show vlan {{vlanId}}', expect: Aparece la VLAN. }
rollback:
  summary: Borra la VLAN.
  steps:
    - { commands: ['no vlan {{vlanId}}'], explanation: Elimina la VLAN. }
sources:
  - { title: Guía, url: 'https://example.com/guide' }
status: { level: docs-checked, reviewed: '2026-10-13', firmware: '10.15' }
`

const fundamental = `
id: what-is-a-switch
title: Qué es un switch
order: 1
summary: Para qué sirve un switch.
sections:
  - heading: La idea
    paragraphs: [Un switch conecta equipos de una red.]
    points: [Aprende direcciones MAC.]
related: [vlan-create]
`

const files = () => ({
  '/src/content/platforms/aruba-aoscx.yaml': platform,
  '/src/content/concepts/vlan-create.yaml': concept,
  '/src/content/procedures/aruba-aoscx/vlan-create.yaml': procedure,
})

describe('buildCatalog', () => {
  it('parses platforms, concepts and procedures', () => {
    const catalog = buildCatalog(files())

    expect(catalog.platforms.map((item) => item.id)).toEqual(['aruba-aoscx'])
    expect(catalog.concepts.map((item) => item.id)).toEqual(['vlan-create'])
    expect(catalog.procedures[0]?.steps[0]?.commands).toEqual(['vlan {{vlanId}}'])
  })

  it('names the file when its content does not match the schema', () => {
    const broken = { ...files(), '/src/content/concepts/vlan-create.yaml': concept.replace('group: vlans-ports', '') }

    expect(() => buildCatalog(broken)).toThrow('/src/content/concepts/vlan-create.yaml')
  })

  it('rejects a procedure whose platform or task does not exist', () => {
    const { '/src/content/platforms/aruba-aoscx.yaml': _platform, ...withoutPlatform } = files()
    const { '/src/content/concepts/vlan-create.yaml': _concept, ...withoutConcept } = files()

    expect(() => buildCatalog(withoutPlatform)).toThrow('unknown platform "aruba-aoscx"')
    expect(() => buildCatalog(withoutConcept)).toThrow('unknown task "vlan-create"')
  })

  it('rejects a procedure stored under a path that does not match its platform and task', () => {
    const { '/src/content/procedures/aruba-aoscx/vlan-create.yaml': moved, ...rest } = files()

    expect(() => buildCatalog({ ...rest, '/src/content/procedures/aruba-aoscx/vlans.yaml': moved })).toThrow(
      'expected path procedures/aruba-aoscx/vlan-create.yaml',
    )
  })

  it('rejects a procedure that uses an undeclared param', () => {
    const broken = {
      ...files(),
      '/src/content/procedures/aruba-aoscx/vlan-create.yaml': procedure.replace('no vlan {{vlanId}}', 'no vlan {{id}}'),
    }

    expect(() => buildCatalog(broken)).toThrow('undeclared params: id')
  })

  it('requires every concept to declare its position inside its group', () => {
    const broken = { ...files(), '/src/content/concepts/vlan-create.yaml': concept.replace('order: 1', '') }

    expect(() => buildCatalog(broken)).toThrow('order')
  })

  it('rejects two concepts that claim the same position in a group', () => {
    const second = concept.replace('id: vlan-create', 'id: port-access')

    expect(() => buildCatalog({ ...files(), '/src/content/concepts/port-access.yaml': second })).toThrow(
      'order 1 is already used by "port-access" in group vlans-ports',
    )
  })

  it('rejects a param that must differ from a param the procedure does not declare', () => {
    const broken = {
      ...files(),
      '/src/content/procedures/aruba-aoscx/vlan-create.yaml': procedure.replace(
        "example: '20' }",
        "example: '20', differentFrom: { param: other, hint: Tiene que ser distinto. } }",
      ),
    }

    expect(() => buildCatalog(broken)).toThrow('param "vlanId" must differ from undeclared param "other"')
  })

  it('rejects a param that must differ from itself', () => {
    const broken = {
      ...files(),
      '/src/content/procedures/aruba-aoscx/vlan-create.yaml': procedure.replace(
        "example: '20' }",
        "example: '20', differentFrom: { param: vlanId, hint: Tiene que ser distinto. } }",
      ),
    }

    expect(() => buildCatalog(broken)).toThrow('param "vlanId" cannot be required to differ from itself')
  })

  it('rejects a platform or concept whose id does not match its file name', () => {
    const { '/src/content/concepts/vlan-create.yaml': moved, ...rest } = files()

    expect(() => buildCatalog({ ...rest, '/src/content/concepts/vlans.yaml': moved })).toThrow(
      'id "vlan-create" does not match the file name',
    )
  })

  it('parses fundamentals articles in reading order', () => {
    const second = fundamental.replace('id: what-is-a-switch', 'id: vendors').replace('order: 1', 'order: 2')
    const catalog = buildCatalog({
      ...files(),
      '/src/content/fundamentals/vendors.yaml': second,
      '/src/content/fundamentals/what-is-a-switch.yaml': fundamental,
    })

    expect(catalog.fundamentals.map((article) => article.id)).toEqual(['what-is-a-switch', 'vendors'])
    expect(catalog.fundamentals[0]?.sections[0]?.points).toEqual(['Aprende direcciones MAC.'])
  })

  it('rejects a fundamentals article that links to a task with no concept', () => {
    const broken = fundamental.replace('related: [vlan-create]', 'related: [vpn-create]')

    expect(() => buildCatalog({ ...files(), '/src/content/fundamentals/what-is-a-switch.yaml': broken })).toThrow(
      'unknown related task "vpn-create"',
    )
  })

  it('rejects two fundamentals articles that claim the same position', () => {
    const second = fundamental.replace('id: what-is-a-switch', 'id: vendors')

    expect(() =>
      buildCatalog({
        ...files(),
        '/src/content/fundamentals/what-is-a-switch.yaml': fundamental,
        '/src/content/fundamentals/vendors.yaml': second,
      }),
    ).toThrow('order 1 is already used by "vendors" in fundamentals')
  })

  it('rejects a fundamentals article that links to a task no brand has a runbook for', () => {
    const lonely = concept.replace('id: vlan-create', 'id: port-access')
    const broken = fundamental.replace('related: [vlan-create]', 'related: [port-access]')

    expect(() =>
      buildCatalog({
        ...files(),
        '/src/content/concepts/port-access.yaml': lonely.replace('order: 1', 'order: 2'),
        '/src/content/fundamentals/what-is-a-switch.yaml': broken,
      }),
    ).toThrow('related task "port-access" has no runbook')
  })
})
