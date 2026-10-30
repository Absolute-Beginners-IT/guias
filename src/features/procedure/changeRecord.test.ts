import { ConceptSchema, PlatformSchema, ProcedureSchema } from '../../domain/schema'
import { buildChangeRecord, changeRecordFileName } from './changeRecord'

const status = { level: 'docs-checked', reviewed: '2026-10-13', firmware: 'AOS-CX 10.15' }
const sources = [{ title: 'Guía oficial de VLAN', url: 'https://example.com/vlan' }]

const platform = PlatformSchema.parse({
  id: 'aruba-aoscx',
  vendor: 'HPE Aruba Networking',
  name: 'Aruba CX 6100',
  os: 'AOS-CX',
  models: ['6100 48G 4SFP+'],
  summary: 'Switch de acceso.',
  cliModes: [{ name: 'Manager', prompt: 'switch#', enter: 'Inicio de sesión', description: 'Consultas.' }],
  configPersistence: 'Se guarda con write memory.',
  safetyNets: [{ name: 'Checkpoint', description: 'Copia con nombre.' }],
  sources,
  status,
})

const concept = ConceptSchema.parse({
  id: 'vlan-create',
  title: 'Crear una VLAN',
  group: 'vlans-ports',
  summary: 'Da de alta una VLAN.',
  explanation: 'Una VLAN separa el tráfico.',
  risks: ['Usar un ID que ya existe.'],
  order: 1,
})

const procedure = ProcedureSchema.parse({
  platform: 'aruba-aoscx',
  task: 'vlan-create',
  summary: 'Crea una VLAN y la guarda.',
  risk: { level: 'low', reason: 'No afecta a los puertos.' },
  params: [
    { id: 'vlanId', label: 'ID de la VLAN', type: 'vlan-id', example: '20' },
    { id: 'vlanName', label: 'Nombre de la VLAN', type: 'text', example: 'VOZ' },
  ],
  preflight: [{ text: 'Revisa las VLAN existentes.', command: 'show vlan' }],
  steps: [
    { title: 'Entrar en configuración', commands: ['config'], explanation: 'Cambia de modo.' },
    { title: 'Crear la VLAN', commands: ['vlan {{vlanId}}', 'name {{vlanName}}'], explanation: 'Crea la VLAN.' },
    { title: 'Avisar al equipo', manual: true, explanation: 'Comunica la VLAN {{vlanId}} a redes.' },
  ],
  verification: [{ command: 'show vlan {{vlanId}}', expect: 'Aparece la VLAN {{vlanId}}.' }],
  rollback: {
    summary: 'Borra la VLAN {{vlanId}}.',
    steps: [{ title: 'Borrar', commands: ['no vlan {{vlanId}}'], explanation: 'Elimina la VLAN.' }],
  },
  sources,
  status,
})

const now = new Date(2026, 9, 15, 9, 5)
const build = (overrides: Partial<Parameters<typeof buildChangeRecord>[0]> = {}) =>
  buildChangeRecord({
    platform,
    concept,
    procedure,
    values: { vlanId: '20', vlanName: 'VOZ' },
    doneSteps: [0, 1],
    record: { device: 'SW-PLANTA2', ticket: 'INC-1234', notes: '', verified: true },
    now,
    ...overrides,
  })

describe('buildChangeRecord', () => {
  it('opens with the task and a summary table of when, where and what', () => {
    const record = build()

    expect(record).toMatch(/^# Registro de cambio: Crear una VLAN\n/)
    expect(record).toContain('| Fecha | 2026-10-15 09:05 |')
    expect(record).toContain('| Equipo | SW-PLANTA2 |')
    expect(record).toContain('| Ticket o referencia | INC-1234 |')
    expect(record).toContain('| Marca y modelo | HPE Aruba Networking Aruba CX 6100 (AOS-CX) |')
    expect(record).toContain('| Guía | Contrastada con documentación · AOS-CX 10.15 · revisada el 2026-10-13 |')
    expect(record).toContain('| Riesgo | Riesgo bajo: No afecta a los puertos. |')
  })

  it('shows a dash for the device and ticket when they were left empty', () => {
    const record = build({ record: { device: ' ', ticket: '', notes: '', verified: false } })

    expect(record).toContain('| Equipo | — |')
    expect(record).toContain('| Ticket o referencia | — |')
  })

  it('lists the values used, marking the ones still missing', () => {
    const record = build({ values: { vlanId: '20' } })

    expect(record).toContain('- ID de la VLAN: 20')
    expect(record).toContain('- Nombre de la VLAN: sin rellenar')
  })

  it('hides secret values in the values list and in the commands', () => {
    const withKey = ProcedureSchema.parse({
      ...procedure,
      params: [...procedure.params, { id: 'authKey', label: 'Clave', type: 'secret', example: 'Clave2026x' }],
      steps: [{ title: 'Crear el usuario', commands: ['user {{authKey}}'], explanation: 'Usa {{authKey}}.' }],
    })

    const record = build({ procedure: withKey, values: { vlanId: '20', authKey: 'S3cretoReal' } })

    expect(record).not.toContain('S3cretoReal')
    expect(record).toContain('- Clave: ********')
    expect(record).toContain('   user ********')
  })

  it('marks each step as done or pending, with its filled commands', () => {
    const record = build({ values: { vlanId: '20' }, doneSteps: [0] })

    expect(record).toContain('## Paso a paso (1 de 3 hechos)')
    expect(record).toContain('1. [x] Entrar en configuración\n\n   ```\n   config\n   ```')
    expect(record).toContain('2. [ ] Crear la VLAN\n\n   ```\n   vlan 20\n   name <vlanName>\n   ```')
  })

  it('describes a manual step in words instead of a command block', () => {
    const record = build()

    expect(record).toContain('3. [ ] Avisar al equipo\n\n   Paso manual: Comunica la VLAN 20 a redes.')
  })

  it('states whether the verification was confirmed', () => {
    expect(build()).toContain('Resultado: correcta')
    expect(build({ record: { device: '', ticket: '', notes: '', verified: false } })).toContain(
      'Resultado: pendiente de confirmar',
    )
  })

  it('includes the preflight checks, the rollback plan and the notes', () => {
    const record = build({ record: { device: '', ticket: '', notes: 'Ventana de 22:00 a 23:00.', verified: true } })

    expect(record).toContain('## Antes de empezar\n\n- Revisa las VLAN existentes. `show vlan`')
    expect(record).toContain('## Vuelta atrás\n\nBorra la VLAN 20.')
    expect(record).toContain('```\n   no vlan 20\n   ```')
    expect(record).toContain('## Notas\n\nVentana de 22:00 a 23:00.')
  })

  it('leaves the notes section out when there are no notes', () => {
    expect(build()).not.toContain('## Notas')
  })
})

describe('changeRecordFileName', () => {
  it('names the file by date, brand and task so records sort chronologically', () => {
    expect(changeRecordFileName(procedure, now)).toBe('2026-10-15_aruba-aoscx_vlan-create.md')
  })
})
