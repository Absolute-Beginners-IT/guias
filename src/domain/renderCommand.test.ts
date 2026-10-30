import { extractParamIds, renderCommand } from './renderCommand'

describe('renderCommand', () => {
  it('replaces every placeholder with its value', () => {
    expect(renderCommand('vlan {{vlanId}}', { vlanId: '20' })).toBe('vlan 20')
  })

  it('replaces repeated and multiple placeholders', () => {
    const rendered = renderCommand('vlan {{id}} name {{name}} # {{id}}', { id: '20', name: 'VOZ' })

    expect(rendered).toBe('vlan 20 name VOZ # 20')
  })

  it('keeps a visible marker when the value is missing or blank', () => {
    expect(renderCommand('vlan {{vlanId}}', {})).toBe('vlan <vlanId>')
    expect(renderCommand('vlan {{vlanId}}', { vlanId: '  ' })).toBe('vlan <vlanId>')
  })

  it('trims surrounding whitespace from values', () => {
    expect(renderCommand('name {{name}}', { name: ' VOZ ' })).toBe('name VOZ')
  })

  it('leaves text without placeholders untouched', () => {
    expect(renderCommand('show vlan', { vlanId: '20' })).toBe('show vlan')
  })
})

describe('extractParamIds', () => {
  it('lists each placeholder id once, in order of appearance', () => {
    expect(extractParamIds('vlan {{id}} name {{name}} # {{id}}')).toEqual(['id', 'name'])
  })

  it('returns an empty list when there are no placeholders', () => {
    expect(extractParamIds('show vlan')).toEqual([])
  })
})
