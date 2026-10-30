import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConceptSchema, PlatformSchema, ProcedureSchema } from '../../domain/schema'
import { RunbookPage } from './RunbookPage'

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
    {
      title: 'Crear la VLAN',
      commands: ['vlan {{vlanId}}', 'name {{vlanName}}'],
      explanation: 'Crea la VLAN {{vlanId}}.',
      breakdown: [{ token: 'vlan', meaning: 'Crea la VLAN indicada.' }],
      warning: 'Comprueba el ID antes de seguir.',
    },
  ],
  verification: [{ command: 'show vlan {{vlanId}}', expect: 'Aparece la VLAN {{vlanId}}.' }],
  rollback: {
    summary: 'Borra la VLAN.',
    steps: [{ title: 'Borrar', commands: ['no vlan {{vlanId}}'], explanation: 'Elimina la VLAN.' }],
    lockoutRecovery: 'Reinicia el switch para volver a la configuración de arranque.',
  },
  sources,
  status,
})

const renderPage = () => render(<RunbookPage platform={platform} concept={concept} procedure={procedure} />)
const section = (name: string) => screen.getByRole('region', { name })

beforeEach(() => {
  localStorage.clear()
})

describe('RunbookPage', () => {
  it('shows the four fixed sections in order', () => {
    renderPage()

    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)

    expect(titles).toEqual([
      'Tus datos',
      'Antes de empezar',
      'Paso a paso',
      'Verificación',
      'Vuelta atrás',
      'Registro del cambio',
      'Fuentes',
    ])
  })

  it('shows the risk level with its reason and the verification status', () => {
    renderPage()

    expect(screen.getByText('Riesgo bajo')).toBeInTheDocument()
    expect(screen.getByText('No afecta a los puertos.')).toBeInTheDocument()
    expect(screen.getByText('Contrastada con documentación')).toBeInTheDocument()
    expect(screen.getByText(/AOS-CX 10\.15/)).toBeInTheDocument()
  })

  it('marks unfilled values in the commands until the user types them', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(within(section('Paso a paso')).getByText('vlan <vlanId>')).toBeInTheDocument()

    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')

    expect(within(section('Paso a paso')).getByText('vlan 20')).toBeInTheDocument()
    expect(within(section('Paso a paso')).getByText('name VOZ')).toBeInTheDocument()
    expect(within(section('Paso a paso')).getByText('Crea la VLAN 20.')).toBeInTheDocument()
    expect(within(section('Verificación')).getByText('show vlan 20')).toBeInTheDocument()
    expect(within(section('Vuelta atrás')).getByText('no vlan 20')).toBeInTheDocument()
  })

  it('explains what is wrong with an invalid value', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('ID de la VLAN'), '5000')

    expect(screen.getByText('Debe ser un número entero entre 1 y 4094.')).toBeInTheDocument()
  })

  it('does not let the user copy a command with missing or invalid values', async () => {
    const user = userEvent.setup()
    renderPage()
    const copyStep = () => within(section('Paso a paso')).getByRole('button', { name: 'Copiar: Crear la VLAN' })

    expect(copyStep()).toBeDisabled()
    expect(
      within(section('Paso a paso')).getByRole('button', { name: 'Copiar: Entrar en configuración' }),
    ).toBeEnabled()

    await user.type(screen.getByLabelText('ID de la VLAN'), '5000')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')
    expect(copyStep()).toBeDisabled()

    await user.clear(screen.getByLabelText('ID de la VLAN'))
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    expect(copyStep()).toBeEnabled()
  })

  it('copies the commands of a step with the real values', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')

    await user.click(screen.getByRole('button', { name: 'Copiar: Crear la VLAN' }))

    expect(await navigator.clipboard.readText()).toBe('vlan 20\nname VOZ')
    expect(screen.getByRole('button', { name: 'Copiar: Crear la VLAN' })).toHaveTextContent('Copiado')
    expect(screen.getByText('Copiado al portapapeles')).toHaveAttribute('role', 'status')
  })

  it('warns prominently, with its notes, when the runbook is unverified', () => {
    const unverified = ProcedureSchema.parse({
      ...procedure,
      status: { ...status, level: 'unverified', notes: 'El borrado no aparece en la documentación.' },
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={unverified} />)

    const notice = screen.getByRole('note', { name: 'Guía sin verificar' })
    expect(notice).toHaveTextContent('Pruébala antes en un equipo de laboratorio')
    expect(notice).toHaveTextContent('El borrado no aparece en la documentación.')
  })

  it('does not show the unverified warning on a runbook checked against the documentation', () => {
    renderPage()

    expect(screen.queryByRole('note', { name: 'Guía sin verificar' })).not.toBeInTheDocument()
  })

  it('copies every step as one block', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')

    await user.click(screen.getByRole('button', { name: 'Copiar todos los pasos' }))

    expect(await navigator.clipboard.readText()).toBe('config\nvlan 20\nname VOZ')
  })

  it('shows the warning, the parameter breakdown and the lockout recovery', () => {
    renderPage()

    expect(screen.getByText('Comprueba el ID antes de seguir.')).toBeInTheDocument()
    expect(screen.getByText('Crea la VLAN indicada.')).toBeInTheDocument()
    expect(screen.getByText('Reinicia el switch para volver a la configuración de arranque.')).toBeInTheDocument()
  })

  it('shows a manual step without a command block or copy button', () => {
    const manual = ProcedureSchema.parse({
      ...procedure,
      steps: [{ title: 'Descargar el archivo', explanation: 'Cópialo a tu equipo.', manual: true }],
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={manual} />)

    expect(within(section('Paso a paso')).getByText('Cópialo a tu equipo.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar: Descargar el archivo' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Hecho: Descargar el archivo' })).toBeInTheDocument()
    expect(within(section('Paso a paso')).getByText('Acción manual')).toBeInTheDocument()
  })

  it('shows a manual rollback step without a command block or copy button', () => {
    const manual = ProcedureSchema.parse({
      ...procedure,
      rollback: {
        summary: 'No confirmes el cambio.',
        steps: [{ title: 'Dejar vencer el temporizador', explanation: 'El switch vuelve solo.', manual: true }],
      },
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={manual} />)

    expect(within(section('Vuelta atrás')).getByText('El switch vuelve solo.')).toBeInTheDocument()
    expect(within(section('Vuelta atrás')).getByText('Acción manual')).toBeInTheDocument()
    expect(within(section('Vuelta atrás')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('links to the same task on the other brands', () => {
    const alternatives = [{ name: 'Cisco Catalyst 1300', href: '#/p/cisco-c1300/vlan-create' }]
    render(<RunbookPage platform={platform} concept={concept} procedure={procedure} alternatives={alternatives} />)

    const nav = screen.getByRole('navigation', { name: 'Misma tarea en otra marca' })

    expect(within(nav).getByRole('link', { name: 'Cisco Catalyst 1300' })).toHaveAttribute(
      'href',
      '#/p/cisco-c1300/vlan-create',
    )
  })

  it('does not offer other brands when none has the task', () => {
    renderPage()

    expect(screen.queryByRole('navigation', { name: 'Misma tarea en otra marca' })).not.toBeInTheDocument()
  })

  it('offers an index that scrolls to each working section', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderPage()
    const index = screen.getByRole('navigation', { name: 'Secciones de la guía' })

    expect(
      within(index)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Tus datos', 'Antes de empezar', 'Paso a paso', 'Verificación', 'Vuelta atrás'])

    await user.click(within(index).getByRole('button', { name: 'Vuelta atrás' }))

    expect(scrollIntoView.mock.instances[0]).toBe(section('Vuelta atrás'))
  })

  it('says so when a runbook needs no values from the user', () => {
    const fixed = ProcedureSchema.parse({
      ...procedure,
      params: [],
      preflight: [{ text: 'Revisa las VLAN.', command: 'show vlan' }],
      steps: [{ title: 'Entrar en configuración', commands: ['config'], explanation: 'Cambia de modo.' }],
      verification: [{ command: 'show vlan', expect: 'Aparecen las VLAN.' }],
      rollback: { summary: 'Nada que deshacer.', steps: [{ commands: ['end'], explanation: 'Sale.' }] },
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={fixed} />)

    expect(within(section('Tus datos')).getByText('Esta guía no necesita datos tuyos.')).toBeInTheDocument()
    expect(within(section('Paso a paso')).getByRole('button', { name: 'Copiar todos los pasos' })).toBeEnabled()
  })

  it('blocks the commands while two values that must differ are the same', async () => {
    const user = userEvent.setup()
    const images = ProcedureSchema.parse({
      ...procedure,
      params: [
        {
          id: 'target',
          label: 'Imagen de destino',
          type: 'choice',
          example: 'secondary',
          options: ['primary', 'secondary'],
          differentFrom: { param: 'fallback', hint: 'No puede ser la misma imagen que la de reserva.' },
        },
        {
          id: 'fallback',
          label: 'Imagen de reserva',
          type: 'choice',
          example: 'primary',
          options: ['primary', 'secondary'],
        },
      ],
      preflight: [{ text: 'Mira las imágenes.' }],
      steps: [{ title: 'Descargar', commands: ['copy file {{target}}'], explanation: 'Descarga.' }],
      verification: [{ command: 'show images', expect: 'Aparece la versión nueva.' }],
      rollback: { summary: 'Volver.', steps: [{ commands: ['boot system {{fallback}}'], explanation: 'Reinicia.' }] },
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={images} />)

    await user.selectOptions(screen.getByLabelText('Imagen de destino'), 'primary')
    await user.selectOptions(screen.getByLabelText('Imagen de reserva'), 'primary')

    expect(screen.getByText('No puede ser la misma imagen que la de reserva.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar: Descargar' })).toBeDisabled()
    expect(within(section('Paso a paso')).getByText('copy file <target>')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Imagen de reserva'), 'secondary')

    expect(screen.getByRole('button', { name: 'Copiar: Descargar' })).toBeEnabled()
    expect(within(section('Paso a paso')).getByText('copy file primary')).toBeInTheDocument()
  })

  it('presents a web-managed runbook as screen steps, without command blocks to copy', () => {
    const webPlatform = PlatformSchema.parse({ ...platform, management: 'web', cliModes: [] })
    const web = ProcedureSchema.parse({
      ...procedure,
      params: [{ id: 'vlanId', label: 'ID de la VLAN', type: 'vlan-id', example: '20' }],
      preflight: [{ text: 'Abre Local Device > VLAN > VLAN List.' }],
      steps: [{ title: 'Añadir la VLAN', explanation: 'Pulsa Add e introduce {{vlanId}}.', manual: true }],
      verification: [{ expect: 'La VLAN {{vlanId}} aparece en VLAN List.' }],
      rollback: { summary: 'Bórrala.', steps: [{ title: 'Borrar', explanation: 'Pulsa Delete.', manual: true }] },
    })
    render(<RunbookPage platform={webPlatform} concept={concept} procedure={web} />)

    expect(within(section('Paso a paso')).getByText('Paso en la interfaz web')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar todos los pasos' })).not.toBeInTheDocument()
    expect(within(section('Verificación')).getByText('La VLAN <vlanId> aparece en VLAN List.')).toBeInTheDocument()
    expect(within(section('Verificación')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('links to the official sources', () => {
    renderPage()

    expect(screen.getByRole('link', { name: 'Guía oficial de VLAN' })).toHaveAttribute(
      'href',
      'https://example.com/vlan',
    )
  })

  it('keeps the values and the step progress after reopening the runbook', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.click(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' }))
    first.unmount()

    renderPage()

    expect(screen.getByLabelText('ID de la VLAN')).toHaveValue('20')
    expect(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Hecho: Entrar en configuración' })).not.toBeChecked()
  })

  describe('with a secret value', () => {
    const withKey = ProcedureSchema.parse({
      ...procedure,
      params: [
        ...procedure.params,
        { id: 'authKey', label: 'Clave de autenticación', type: 'secret', example: 'Clave2026x' },
      ],
      steps: [
        ...procedure.steps,
        { title: 'Crear el usuario', commands: ['user monitor auth {{authKey}}'], explanation: 'Crea el usuario.' },
      ],
    })
    const renderWithKey = () => render(<RunbookPage platform={platform} concept={concept} procedure={withKey} />)

    it('shows the secret in the command and copies it, without writing it to the browser storage', async () => {
      const user = userEvent.setup()
      renderWithKey()
      await user.type(screen.getByLabelText('ID de la VLAN'), '20')
      await user.type(screen.getByLabelText('Clave de autenticación'), 'S3cretoReal')

      expect(screen.getByText('user monitor auth S3cretoReal')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Copiar: Crear el usuario' }))
      expect(await navigator.clipboard.readText()).toBe('user monitor auth S3cretoReal')
      expect(JSON.stringify({ ...localStorage })).not.toContain('S3cretoReal')
      expect(JSON.stringify({ ...localStorage })).toContain('20')
    })

    it('forgets the secret when the runbook is opened again, keeping the other values', async () => {
      const user = userEvent.setup()
      const first = renderWithKey()
      await user.type(screen.getByLabelText('ID de la VLAN'), '20')
      await user.type(screen.getByLabelText('Clave de autenticación'), 'S3cretoReal')
      first.unmount()

      renderWithKey()

      expect(screen.getByLabelText('ID de la VLAN')).toHaveValue('20')
      expect(screen.getByLabelText('Clave de autenticación')).toHaveValue('')
    })

    it('drops a secret left in the browser storage when another value changes', async () => {
      localStorage.setItem('switching-manual:aruba-aoscx/vlan-create:values', JSON.stringify({ authKey: 'Antigua123' }))
      const user = userEvent.setup()
      renderWithKey()

      expect(screen.getByLabelText('Clave de autenticación')).toHaveValue('')
      await user.type(screen.getByLabelText('ID de la VLAN'), '20')

      expect(JSON.stringify({ ...localStorage })).not.toContain('Antigua123')
    })

    it('clears the secret on request', async () => {
      const user = userEvent.setup()
      renderWithKey()
      await user.type(screen.getByLabelText('Clave de autenticación'), 'S3cretoReal')

      await user.click(screen.getByRole('button', { name: 'Limpiar datos y progreso' }))

      expect(screen.getByLabelText('Clave de autenticación')).toHaveValue('')
    })

    it('leaves the secret out of the copied change record', async () => {
      const user = userEvent.setup()
      renderWithKey()
      await user.type(screen.getByLabelText('Clave de autenticación'), 'S3cretoReal')

      await user.click(screen.getByRole('button', { name: 'Copiar registro del cambio' }))

      const copied = await navigator.clipboard.readText()
      expect(copied).not.toContain('S3cretoReal')
      expect(copied).toContain('- Clave de autenticación: ********')
    })

    it('tells the user the secret is not saved', () => {
      renderWithKey()

      expect(screen.getByText(/No se guarda en el navegador ni en el registro del cambio/)).toBeInTheDocument()
    })
  })

  it('clears the values and the progress on request', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.click(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' }))

    await user.click(screen.getByRole('button', { name: 'Limpiar datos y progreso' }))

    expect(screen.getByLabelText('ID de la VLAN')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' })).not.toBeChecked()
  })

  it('copies a change record with the device, ticket, values, progress and verification result', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')
    await user.click(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' }))
    const record = section('Registro del cambio')
    await user.type(within(record).getByLabelText('Equipo (nombre o IP)'), 'SW-PLANTA2')
    await user.type(within(record).getByLabelText('Ticket o referencia'), 'INC-1234')
    await user.click(within(record).getByRole('checkbox', { name: 'Verificación correcta' }))

    await user.click(within(record).getByRole('button', { name: 'Copiar registro del cambio' }))

    const copied = await navigator.clipboard.readText()
    expect(copied).toMatch(/^# Registro de cambio: Crear una VLAN/)
    expect(copied).toContain('| Equipo | SW-PLANTA2 |')
    expect(copied).toContain('| Ticket o referencia | INC-1234 |')
    expect(copied).toContain('2. [x] Crear la VLAN')
    expect(copied).toContain('vlan 20')
    expect(copied).toContain('Resultado: correcta')
  })

  it('keeps the change record fields when the page is opened again', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await user.type(within(section('Registro del cambio')).getByLabelText('Equipo (nombre o IP)'), 'SW-PLANTA2')

    unmount()
    renderPage()

    expect(within(section('Registro del cambio')).getByLabelText('Equipo (nombre o IP)')).toHaveValue('SW-PLANTA2')
  })

  it('clears the change record together with the values and progress', async () => {
    const user = userEvent.setup()
    renderPage()
    const record = section('Registro del cambio')
    await user.type(within(record).getByLabelText('Equipo (nombre o IP)'), 'SW-PLANTA2')
    await user.type(within(record).getByLabelText('Notas'), 'Ventana nocturna.')
    await user.click(within(record).getByRole('checkbox', { name: 'Verificación correcta' }))

    await user.click(screen.getByRole('button', { name: 'Limpiar datos y progreso' }))

    expect(within(record).getByLabelText('Equipo (nombre o IP)')).toHaveValue('')
    expect(within(record).getByLabelText('Notas')).toHaveValue('')
    expect(within(record).getByRole('checkbox', { name: 'Verificación correcta' })).not.toBeChecked()
  })

  it('downloads the change record as a Markdown file named by date, brand and task', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:record')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clicked: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download)
    })
    renderPage()

    await user.click(within(section('Registro del cambio')).getByRole('button', { name: 'Descargar .md' }))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(await blob.text()).toMatch(/^# Registro de cambio: Crear una VLAN/)
    expect(clicked[0]).toMatch(/^\d{4}-\d{2}-\d{2}_aruba-aoscx_vlan-create\.md$/)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:record')
    click.mockRestore()
  })

  it('opens the print dialog to save the runbook as PDF', async () => {
    const user = userEvent.setup()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderPage()

    await user.click(
      within(section('Registro del cambio')).getByRole('button', { name: 'Imprimir o guardar como PDF' }),
    )

    expect(print).toHaveBeenCalledOnce()
    print.mockRestore()
  })
})
