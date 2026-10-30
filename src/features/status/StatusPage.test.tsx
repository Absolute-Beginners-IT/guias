import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { catalog } from '../../content/catalog'
import type { Catalog } from '../../domain/buildCatalog'
import { StatusPage } from './StatusPage'

// One runbook already tested on real equipment, so the pending filter has something to hide.
const withOneLabTested: Catalog = {
  ...catalog,
  procedures: catalog.procedures.map((item) =>
    item.platform === 'aruba-aoscx' && item.task === 'vlan-create'
      ? { ...item, status: { ...item.status, level: 'lab-tested', notes: 'Probada en el laboratorio.' } }
      : item,
  ),
}

const matrix = () => screen.getByRole('table', { name: 'Guías por marca y tarea' })
const vlanRow = () => within(matrix()).getByRole('row', { name: /^Crear una VLAN/ })

describe('StatusPage', () => {
  it('summarises how many runbooks are in each verification level', () => {
    render(<StatusPage catalog={withOneLabTested} now={new Date(2026, 9, 15)} />)

    const summary = screen.getByRole('list', { name: 'Resumen por estado' })
    expect(within(summary).getByText('Probada en equipo real').closest('li')).toHaveTextContent('1')
  })

  it('hides the runbooks already tested on real equipment when only pending ones are asked for', async () => {
    const user = userEvent.setup()
    render(<StatusPage catalog={withOneLabTested} now={new Date(2026, 9, 15)} />)
    expect(within(vlanRow()).getByRole('link', { name: /Aruba CX 6100/ })).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Solo pendientes de probar' }))

    expect(within(vlanRow()).queryByRole('link', { name: /Aruba CX 6100/ })).not.toBeInTheDocument()
    expect(within(vlanRow()).getByRole('link', { name: /Cisco Catalyst 1300/ })).toBeInTheDocument()
  })

  it('marks the runbooks that are due for review', () => {
    render(<StatusPage catalog={catalog} now={new Date(2027, 5, 1)} />)

    expect(within(vlanRow()).getAllByText('Revisar').length).toBeGreaterThan(0)
  })
})
