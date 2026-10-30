import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { catalog } from '../../content/catalog'
import { PlannerPage } from './PlannerPage'
import { twoSwitchPlan } from './planFixtures'
import { PLAN_STORAGE_KEY } from './usePlan'

const seed = () => localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(twoSwitchPlan()))
const openTab = (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
  user.click(screen.getByRole('tab', { name }))

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/plan'
})

describe('PlannerPage', () => {
  it('lists what is missing before showing a guide', async () => {
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    await openTab(user, /^Guía/)

    const issues = screen.getByRole('list', { name: 'Puntos por corregir' })
    expect(within(issues).getByText('Añade al menos una VLAN.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: /^1\./ })).not.toBeInTheDocument()
  })

  it('does not flag anything while the plan is still empty', () => {
    render(<PlannerPage catalog={catalog} />)

    expect(screen.getByRole('tab', { name: 'VLAN' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Puntos por corregir en esta sección' })).not.toBeInTheDocument()
  })

  it('builds the guide from the VLANs and switches the user enters', async () => {
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    await user.click(screen.getByRole('button', { name: 'Añadir VLAN' }))
    await user.clear(screen.getByRole('spinbutton', { name: 'ID de la VLAN 1' }))
    await user.type(screen.getByRole('spinbutton', { name: 'ID de la VLAN 1' }), '99')
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' }), 'GESTION')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Propósito de la VLAN 1' }), 'Gestión')

    await openTab(user, /^Switches/)
    await user.click(screen.getByRole('button', { name: 'Añadir switch' }))
    await user.type(screen.getByRole('textbox', { name: 'Nombre del switch 1' }), 'nucleo')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Modelo del switch 1' }), 'Aruba CX 6100')
    await user.type(screen.getByRole('textbox', { name: 'IP de gestión del switch 1' }), '192.168.99.2/24')

    await openTab(user, /^Guía/)

    const guide = screen.getByRole('region', { name: '1. nucleo · Aruba CX 6100' })
    const vlanStep = within(guide).getByRole('listitem', { name: 'Crear la VLAN 99 (GESTION)' })
    expect(within(vlanStep).getAllByText('vlan 99').length).toBeGreaterThan(0)
    expect(within(guide).getByRole('listitem', { name: 'IP de gestión 192.168.99.2/24' })).toBeInTheDocument()
  })

  it('keeps the plan after leaving the page', async () => {
    seed()
    const { unmount } = render(<PlannerPage catalog={catalog} />)
    unmount()

    render(<PlannerPage catalog={catalog} />)

    expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')
  })

  it('shows the issues of each section on its tab', async () => {
    seed()
    const plan = twoSwitchPlan()
    plan.ports.push({ id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/6', vlan: 30 })
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    expect(screen.getByRole('tab', { name: /^Puertos/ })).toHaveAccessibleName('Puertos (1 por corregir)')
    await openTab(user, /^Puertos/)

    expect(screen.getByText('El puerto gi1/0/6 de planta1 usa la VLAN 30, que no está en el plan.')).toBeInTheDocument()
  })

  it('tells what the user still has to look up and opens the full runbook with the values filled', async () => {
    seed()
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)
    await openTab(user, /^Guía/)

    const floor = screen.getByRole('region', { name: '2. planta1 · Cisco Catalyst 1300' })
    const access = within(floor).getByRole('listitem', { name: 'Puerto gi1/0/5 en la VLAN 10 (USUARIOS)' })
    expect(within(access).getByText(/VLAN que tiene ahora el puerto/)).toBeInTheDocument()

    await user.click(within(access).getByRole('button', { name: 'Abrir la guía con estos datos' }))

    expect(window.location.hash).toBe('#/p/cisco-c1300/port-access')
    expect(JSON.parse(localStorage.getItem('switching-manual:cisco-c1300/port-access:values') ?? '{}')).toEqual({
      interfaceId: 'gi1/0/5',
      vlanId: '10',
    })
  })

  it('draws the map of the network from the plan', () => {
    seed()
    render(<PlannerPage catalog={catalog} />)

    const map = screen.getByRole('img', { name: /^Mapa de la red/ })
    expect(map).toHaveAccessibleName(
      'Mapa de la red: nucleo (Aruba CX 6100) unido a planta1 (Cisco Catalyst 1300) por 1/1/49 y gi1/0/48',
    )
    expect(within(map).getByText('nucleo')).toBeInTheDocument()
    expect(within(map).getByText('192.168.99.3/24')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Leyenda de VLAN' })).getByText('10 USUARIOS')).toBeInTheDocument()
  })

  it('keeps a long switch name from running into the core label on the map', () => {
    const plan = twoSwitchPlan()
    const core = plan.switches[0]
    if (!core) throw new Error('fixture')
    core.name = 'sw-marmarra-sotano-principal'
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
    render(<PlannerPage catalog={catalog} />)

    const map = screen.getByRole('img', { name: /^Mapa de la red: sw-marmarra-sotano-principal/ })
    const name = within(map).getByText('sw-marmarra-sotano-p…')
    expect(name.parentElement?.querySelector('title')).toHaveTextContent('sw-marmarra-sotano-principal')
    expect(within(map).getByText('Núcleo')).not.toHaveAttribute('text-anchor', 'end')
  })

  describe('when the browser can measure text', () => {
    // jsdom has no layout, so each test gives every character a fixed width in pixels.
    const measureAs = (pixelsPerChar: number) => {
      Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
        configurable: true,
        value(this: SVGElement) {
          return (this.textContent ?? '').length * pixelsPerChar
        },
      })
    }
    afterEach(() => {
      Reflect.deleteProperty(SVGElement.prototype, 'getComputedTextLength')
    })
    const mapWithCoreNamed = (name: string) => {
      const plan = twoSwitchPlan()
      const core = plan.switches[0]
      if (!core) throw new Error('fixture')
      core.name = name
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
      render(<PlannerPage catalog={catalog} />)
      return screen.getByRole('img', { name: /^Mapa de la red/ })
    }

    it('shortens a name of wide letters to the width of the card', () => {
      measureAs(14)
      const map = mapWithCoreNamed('MMMMMMMMMMMMMMMMMMMM')

      const name = within(map).getByText('MMMMMMMMMM…')
      expect(name.parentElement?.querySelector('title')).toHaveTextContent('MMMMMMMMMMMMMMMMMMMM')
    })

    it('shows the fitted name when it matches the character rule it starts from', () => {
      // 21 characters of 7.9 px take 165.9 px, so the measured fit is the same 20 characters plus "…".
      measureAs(7.9)
      // With 23 characters the search tries 21 last, which does not fit, before settling on 20.
      const map = mapWithCoreNamed('aaaaaaaaaaaaaaaaaaaaaaa')

      expect(within(map).getByText('aaaaaaaaaaaaaaaaaaaa…')).toBeInTheDocument()
    })

    it('keeps a long name of narrow letters whole when it fits', () => {
      measureAs(4)
      const map = mapWithCoreNamed('iiiiiiiiiiiiiiiiiiiiiiiiiiii')

      const name = within(map).getByText('iiiiiiiiiiiiiiiiiiiiiiiiiiii')
      expect(name.parentElement?.querySelector('title')).toBeNull()
    })
  })

  it('marks on the map the switches with no path to the core', () => {
    const plan = twoSwitchPlan()
    plan.links = []
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
    render(<PlannerPage catalog={catalog} />)

    expect(within(screen.getByRole('img', { name: /^Mapa de la red/ })).getByText('Sin enlace')).toBeInTheDocument()
  })

  it('starts the VLANs from a template by purpose', async () => {
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    await user.click(screen.getByRole('button', { name: 'Oficina con telefonía y cámaras' }))

    const table = screen.getByRole('table', { name: 'VLAN del plan' })
    expect(within(table).getAllByRole('row')).toHaveLength(6)
    expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')
    expect(screen.queryByRole('button', { name: 'Oficina pequeña' })).not.toBeInTheDocument()
  })

  it('exports the plan as a JSON file', async () => {
    seed()
    const user = userEvent.setup()
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:plan')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clicked: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download)
    })
    render(<PlannerPage catalog={catalog} />)

    await user.click(screen.getByRole('button', { name: 'Exportar plan' }))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(JSON.parse(await blob.text())).toEqual(twoSwitchPlan())
    expect(clicked[0]).toMatch(/^plan-de-red_\d{4}-\d{2}-\d{2}\.json$/)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:plan')
    click.mockRestore()
  })

  it('imports a plan from a JSON file', async () => {
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)
    const file = new File([JSON.stringify(twoSwitchPlan())], 'plan.json', { type: 'application/json' })

    await user.upload(screen.getByLabelText('Importar plan'), file)

    expect(await screen.findByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')
  })

  it('rejects a file that is not a plan and keeps the current one', async () => {
    seed()
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    await user.upload(screen.getByLabelText('Importar plan'), new File(['{"hola": 1}'], 'otro.json'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese archivo no es un plan de red válido.')
    expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')
  })

  it('asks before replacing or emptying a plan with content', async () => {
    seed()
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<PlannerPage catalog={catalog} />)

    await user.click(screen.getByRole('button', { name: 'Vaciar plan' }))
    expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')

    await user.click(screen.getByRole('button', { name: 'Vaciar plan' }))
    expect(screen.queryByRole('textbox', { name: 'Nombre de la VLAN 1' })).not.toBeInTheDocument()
    expect(confirm).toHaveBeenCalledWith('Se va a borrar el plan actual. ¿Continuar?')
    confirm.mockRestore()
  })

  it('removes the links and ports of a switch that is deleted', async () => {
    seed()
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)
    await openTab(user, /^Switches/)

    await user.click(screen.getByRole('button', { name: 'Quitar el switch planta1' }))
    await openTab(user, /^Puertos/)

    expect(screen.queryByRole('textbox', { name: 'Puerto 1' })).not.toBeInTheDocument()
  })
})
