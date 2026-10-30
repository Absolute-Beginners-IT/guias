import { catalog } from '../../content/catalog'
import { buildSearchIndex } from './searchIndex'

const search = buildSearchIndex(catalog)
// Runbooks are reported as platform/task, articles as f/<article>, both taken from where the hit leads.
const keys = (query: string) => search(query).map((hit) => hit.href.replace(/^#\/(p\/)?/, ''))

describe('search index', () => {
  it('returns nothing for a blank query', () => {
    expect(search('   ')).toEqual([])
  })

  it('finds a runbook by task words and narrows it by brand', () => {
    expect(keys('trunk')).toEqual(
      expect.arrayContaining(['aruba-aoscx/port-trunk', 'cisco-c1300/port-trunk', 'mikrotik-routeros/port-trunk']),
    )
    expect(keys('trunk cisco')[0]).toBe('cisco-c1300/port-trunk')
    expect(keys('trunk cisco')).not.toContain('aruba-aoscx/port-trunk')
  })

  it('ignores accents and letter case', () => {
    expect(keys('GESTION aruba')).toContain('aruba-aoscx/mgmt-ip')
    expect(keys('agregacion')).toContain('cisco-c1300/lag-create')
  })

  it('matches while the word is still being typed', () => {
    expect(keys('restau')).toContain('aruba-aoscx/config-restore')
  })

  it('finds a runbook by a command it contains', () => {
    expect(keys('channel-group')).toEqual(['cisco-c1300/lag-create'])
  })

  it('finds runbooks by their task group', () => {
    expect(keys('puesta en marcha mikrotik')).toEqual(
      expect.arrayContaining(['mikrotik-routeros/config-backup', 'mikrotik-routeros/mgmt-ip']),
    )
  })

  it('describes each hit with what the user needs to recognise it', () => {
    const hit = search('poe aruba')[0]

    expect(hit).toEqual({
      href: '#/p/aruba-aoscx/poe-port',
      title: 'Reiniciar un dispositivo PoE y fijar su prioridad',
      detail: 'Aruba CX 6100 · VLANs y puertos',
    })
  })

  it('finds fundamentals articles by their title, ignoring accents', () => {
    expect(keys('que es un switch')[0]).toBe('f/what-is-a-switch')
  })

  it('finds fundamentals articles by words in their text', () => {
    expect(keys('broadcast')).toEqual(['f/what-is-a-switch'])
  })

  it('describes a fundamentals article as such', () => {
    expect(search('marcas y sus sistemas')[0]).toEqual({
      href: '#/f/vendors',
      title: 'Las marcas y sus sistemas',
      detail: 'Fundamentos',
    })
  })
})
