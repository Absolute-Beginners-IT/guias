import { findUndeclaredParams, PlatformSchema, ProcedureSchema } from './schema'

const basePlatform = () => ({
  id: 'ruijie-reyee',
  vendor: 'Ruijie',
  name: 'Ruijie NBS3200',
  os: 'ReyeeOS',
  models: ['RG-NBS3200-48GT4XS-P'],
  summary: 'Switch gestionado por web.',
  configPersistence: 'Cada cambio se guarda al pulsar Save.',
  safetyNets: [{ name: 'Copia de configuración', description: 'Backup desde la web.' }],
  sources: [{ title: 'Guía', url: 'https://example.com/guide' }],
  status: { level: 'docs-checked', reviewed: '2026-10-14', firmware: 'ReyeeOS 2.341' },
})

describe('PlatformSchema', () => {
  it('requires CLI modes for a platform managed from the command line', () => {
    expect(PlatformSchema.safeParse({ ...basePlatform(), management: 'cli', cliModes: [] }).success).toBe(false)
  })

  it('accepts a platform managed from its web interface without CLI modes', () => {
    const platform = PlatformSchema.parse({ ...basePlatform(), management: 'web' })

    expect(platform.cliModes).toEqual([])
  })

  it('treats a platform as managed from the command line unless stated otherwise', () => {
    const modes = [{ name: 'Manager', prompt: 'switch#', enter: 'Al iniciar sesión', description: 'Consultas.' }]

    expect(PlatformSchema.parse({ ...basePlatform(), cliModes: modes }).management).toBe('cli')
  })
})

const validProcedure = () => ({
  platform: 'aruba-aoscx',
  task: 'vlan-create',
  summary: 'Crea una VLAN.',
  risk: { level: 'low', reason: 'No afecta al tráfico existente.' },
  params: [{ id: 'vlanId', label: 'ID de VLAN', type: 'vlan-id', example: '20' }],
  preflight: [{ text: 'Guarda la configuración actual.' }],
  steps: [
    {
      title: 'Crear la VLAN',
      commands: ['vlan {{vlanId}}'],
      explanation: 'Crea la VLAN y entra en su contexto.',
    },
  ],
  verification: [{ command: 'show vlan {{vlanId}}', expect: 'La VLAN aparece como up.' }],
  rollback: {
    summary: 'Elimina la VLAN creada.',
    steps: [{ commands: ['no vlan {{vlanId}}'], explanation: 'Borra la VLAN.' }],
  },
  sources: [{ title: 'Guía oficial', url: 'https://example.com/guide' }],
  status: { level: 'docs-checked', reviewed: '2026-10-13', firmware: '10.13' },
})

describe('ProcedureSchema', () => {
  it('accepts a complete procedure and defaults params to required', () => {
    const procedure = ProcedureSchema.parse(validProcedure())

    expect(procedure.params[0]?.required).toBe(true)
  })

  it.each(['rollback', 'sources', 'risk', 'verification', 'status'])('rejects a procedure without %s', (field) => {
    const procedure: Record<string, unknown> = validProcedure()
    delete procedure[field]

    expect(ProcedureSchema.safeParse(procedure).success).toBe(false)
  })

  it('rejects empty steps, rollback steps and sources', () => {
    expect(ProcedureSchema.safeParse({ ...validProcedure(), steps: [] }).success).toBe(false)
    expect(ProcedureSchema.safeParse({ ...validProcedure(), sources: [] }).success).toBe(false)
    expect(ProcedureSchema.safeParse({ ...validProcedure(), rollback: { summary: 'x', steps: [] } }).success).toBe(
      false,
    )
  })

  it('accepts a step without commands only when it is declared manual', () => {
    const base = validProcedure()
    const manualStep = { title: 'Descargar el archivo', explanation: 'Cópialo a tu equipo.' }
    const withSteps = (steps: unknown[]) => ProcedureSchema.safeParse({ ...base, steps })

    expect(withSteps([{ ...manualStep, manual: true }]).success).toBe(true)
    expect(withSteps([manualStep]).success).toBe(false)
    expect(withSteps([{ ...manualStep, commands: [] }]).success).toBe(false)
  })

  it('rejects a manual step that also carries commands', () => {
    const base = validProcedure()
    const step = { title: 'Crear', commands: ['vlan {{vlanId}}'], explanation: 'x', manual: true }

    expect(ProcedureSchema.safeParse({ ...base, steps: [step] }).success).toBe(false)
  })

  it('points at the offending step and field when the manual rule is broken', () => {
    const base = validProcedure()
    const result = ProcedureSchema.safeParse({
      ...base,
      steps: [...base.steps, { title: 'Descargar el archivo', explanation: 'Cópialo a tu equipo.' }],
    })

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['steps.1.commands'])
  })

  it('applies the same manual rule to rollback steps', () => {
    const base = validProcedure()
    const withRollback = (step: unknown) =>
      ProcedureSchema.safeParse({ ...base, rollback: { summary: 'x', steps: [step] } })

    expect(withRollback({ explanation: 'Espera a que venza el temporizador.', manual: true }).success).toBe(true)
    expect(withRollback({ explanation: 'Espera a que venza el temporizador.' }).success).toBe(false)
  })

  it('accepts a check that is read on screen instead of with a command', () => {
    const procedure = ProcedureSchema.parse({
      ...validProcedure(),
      verification: [{ expect: 'En VLAN List aparece la VLAN 20.' }],
    })

    expect(procedure.verification[0]?.command).toBeUndefined()
  })

  it('rejects an unknown verification status', () => {
    const procedure = { ...validProcedure(), status: { level: 'trusted', reviewed: '2026-10-13', firmware: '10.13' } }

    expect(ProcedureSchema.safeParse(procedure).success).toBe(false)
  })

  it('rejects a choice param without options', () => {
    const procedure = {
      ...validProcedure(),
      params: [{ id: 'mode', label: 'Modo', type: 'choice', example: 'access' }],
    }

    expect(ProcedureSchema.safeParse(procedure).success).toBe(false)
  })
})

describe('findUndeclaredParams', () => {
  it('returns nothing when every placeholder is declared', () => {
    expect(findUndeclaredParams(ProcedureSchema.parse(validProcedure()))).toEqual([])
  })

  it('reports placeholders used in steps, verification, preflight and rollback', () => {
    const base = validProcedure()
    const procedure = ProcedureSchema.parse({
      ...base,
      preflight: [{ text: 'Revisa el puerto.', command: 'show interface {{port}}' }],
      steps: [{ ...base.steps[0], commands: ['vlan {{vlanId}}', 'name {{name}}'] }],
      verification: [{ command: 'show vlan {{vlan}}', expect: 'x' }],
      rollback: { summary: 'x', steps: [{ commands: ['no vlan {{old}}'], explanation: 'x' }] },
    })

    expect(findUndeclaredParams(procedure)).toEqual(['port', 'name', 'vlan', 'old'])
  })
})
