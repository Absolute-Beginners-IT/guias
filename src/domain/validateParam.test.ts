import type { Param } from './schema'
import { validateParam } from './validateParam'

const param = (overrides: Partial<Param>): Param => ({
  id: 'p',
  label: 'Parámetro',
  type: 'text',
  example: 'x',
  required: true,
  ...overrides,
})

describe('validateParam', () => {
  it('rejects a blank required value', () => {
    expect(validateParam(param({}), '  ')).toBe('Este dato es obligatorio.')
  })

  it('accepts a blank optional value', () => {
    expect(validateParam(param({ required: false }), '')).toBeNull()
  })

  it('accepts VLAN IDs from 1 to 4094 only', () => {
    const vlan = param({ type: 'vlan-id' })

    expect(validateParam(vlan, '1')).toBeNull()
    expect(validateParam(vlan, '4094')).toBeNull()
    expect(validateParam(vlan, '0')).toBe('Debe ser un número entero entre 1 y 4094.')
    expect(validateParam(vlan, '4095')).toBe('Debe ser un número entero entre 1 y 4094.')
    expect(validateParam(vlan, '20a')).toBe('Debe ser un número entero entre 1 y 4094.')
  })

  it('checks numbers against their declared range', () => {
    const number = param({ type: 'number', min: 1, max: 8 })

    expect(validateParam(number, '8')).toBeNull()
    expect(validateParam(number, '9')).toBe('Debe ser un número entero entre 1 y 8.')
    expect(validateParam(number, '1.5')).toBe('Debe ser un número entero entre 1 y 8.')
  })

  it('validates IPv4 addresses', () => {
    const ip = param({ type: 'ipv4' })

    expect(validateParam(ip, '192.168.10.1')).toBeNull()
    expect(validateParam(ip, '192.168.10.256')).toBe('Debe ser una dirección IPv4 válida, por ejemplo 192.168.10.1.')
    expect(validateParam(ip, '192.168.10')).toBe('Debe ser una dirección IPv4 válida, por ejemplo 192.168.10.1.')
  })

  it('validates IPv4 addresses with prefix length', () => {
    const cidr = param({ type: 'cidr' })

    expect(validateParam(cidr, '192.168.10.1/24')).toBeNull()
    expect(validateParam(cidr, '192.168.10.1/33')).toBe('Debe ser una IPv4 con prefijo, por ejemplo 192.168.10.1/24.')
    expect(validateParam(cidr, '192.168.10.1')).toBe('Debe ser una IPv4 con prefijo, por ejemplo 192.168.10.1/24.')
  })

  it('restricts choices to the declared options', () => {
    const choice = param({ type: 'choice', options: ['access', 'trunk'] })

    expect(validateParam(choice, 'trunk')).toBeNull()
    expect(validateParam(choice, 'hybrid')).toBe('Elige una de las opciones disponibles.')
  })

  it('applies the declared pattern to text and reports its hint', () => {
    const name = param({ pattern: '^[A-Za-z0-9_-]{1,32}$', patternHint: 'Sin espacios, hasta 32 caracteres.' })

    expect(validateParam(name, 'VOZ_IP')).toBeNull()
    expect(validateParam(name, 'VOZ IP')).toBe('Sin espacios, hasta 32 caracteres.')
  })

  it('applies the declared pattern to a secret and reports its hint', () => {
    const key = param({ type: 'secret', pattern: '^[A-Za-z0-9]{8,32}$', patternHint: 'De 8 a 32 caracteres.' })

    expect(validateParam(key, 'Clave2026x')).toBeNull()
    expect(validateParam(key, 'corta')).toBe('De 8 a 32 caracteres.')
  })
})

describe('validateParam with a value that must differ from another one', () => {
  const target = param({
    type: 'choice',
    options: ['primary', 'secondary'],
    differentFrom: { param: 'fallback', hint: 'No puede ser la misma imagen que la de reserva.' },
  })

  it('rejects the same value as the related param', () => {
    expect(validateParam(target, 'primary', { fallback: 'primary' })).toBe(
      'No puede ser la misma imagen que la de reserva.',
    )
  })

  it('accepts a different value, or any value while the related param is still empty', () => {
    expect(validateParam(target, 'primary', { fallback: 'secondary' })).toBeNull()
    expect(validateParam(target, 'primary', { fallback: '  ' })).toBeNull()
    expect(validateParam(target, 'primary', {})).toBeNull()
  })

  it('compares ignoring surrounding spaces', () => {
    expect(validateParam(target, ' primary ', { fallback: 'primary ' })).toBe(
      'No puede ser la misma imagen que la de reserva.',
    )
  })
})

describe('validateParam with ranges that include negative numbers', () => {
  const offset = param({ type: 'number', min: -12, max: 13 })

  it('accepts negative integers inside the range', () => {
    expect(validateParam(offset, '-5')).toBeNull()
    expect(validateParam(offset, '-12')).toBeNull()
    expect(validateParam(offset, '0')).toBeNull()
  })

  it('still rejects a sign in the prefix of an address with prefix', () => {
    expect(validateParam(param({ type: 'cidr' }), '192.168.10.1/-0')).toBe(
      'Debe ser una IPv4 con prefijo, por ejemplo 192.168.10.1/24.',
    )
  })

  it('still rejects a sign inside an IPv4 address', () => {
    expect(validateParam(param({ type: 'ipv4' }), '192.168.-0.1')).toBe(
      'Debe ser una dirección IPv4 válida, por ejemplo 192.168.10.1.',
    )
  })

  it('rejects values below the minimum and malformed signs', () => {
    expect(validateParam(offset, '-13')).toBe('Debe ser un número entero entre -12 y 13.')
    expect(validateParam(offset, '--1')).toBe('Debe ser un número entero entre -12 y 13.')
    expect(validateParam(offset, '-')).toBe('Debe ser un número entero entre -12 y 13.')
  })
})
