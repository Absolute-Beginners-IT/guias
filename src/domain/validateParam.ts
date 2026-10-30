import type { Param } from './schema'

const INTEGER = /^-?\d+$/
const DIGITS = /^\d+$/

function isIntegerInRange(value: string, min: number, max: number): boolean {
  if (!INTEGER.test(value)) return false
  const number = Number(value)
  return number >= min && number <= max
}

export function isIpv4(value: string): boolean {
  const octets = value.split('.')
  return octets.length === 4 && octets.every((octet) => DIGITS.test(octet) && isIntegerInRange(octet, 0, 255))
}

export function isCidr(value: string): boolean {
  const [address, prefix, ...rest] = value.split('/')
  if (address === undefined || prefix === undefined || rest.length > 0) return false
  return isIpv4(address) && DIGITS.test(prefix) && isIntegerInRange(prefix, 0, 32)
}

function validateFormat(param: Param, value: string): string | null {
  switch (param.type) {
    case 'vlan-id':
      return isIntegerInRange(value, 1, 4094) ? null : 'Debe ser un número entero entre 1 y 4094.'
    case 'number': {
      const min = param.min ?? 0
      const max = param.max ?? Number.MAX_SAFE_INTEGER
      if (isIntegerInRange(value, min, max)) return null
      return param.max === undefined
        ? `Debe ser un número entero mayor o igual que ${min}.`
        : `Debe ser un número entero entre ${min} y ${max}.`
    }
    case 'ipv4':
      return isIpv4(value) ? null : 'Debe ser una dirección IPv4 válida, por ejemplo 192.168.10.1.'
    case 'cidr':
      return isCidr(value) ? null : 'Debe ser una IPv4 con prefijo, por ejemplo 192.168.10.1/24.'
    case 'choice':
      return param.options?.includes(value) ? null : 'Elige una de las opciones disponibles.'
    case 'text':
    case 'secret':
      if (param.pattern && !new RegExp(param.pattern).test(value)) {
        return param.patternHint ?? 'El formato no es válido.'
      }
      return null
  }
}

/**
 * Returns the message to show the user, or null when the value is acceptable.
 * `values` holds the other params of the runbook, for rules that relate two of them.
 */
export function validateParam(
  param: Param,
  rawValue: string,
  values: Record<string, string | undefined> = {},
): string | null {
  const value = rawValue.trim()
  if (value === '') return param.required ? 'Este dato es obligatorio.' : null

  const formatError = validateFormat(param, value)
  if (formatError) return formatError

  const other = param.differentFrom && values[param.differentFrom.param]?.trim()
  return param.differentFrom && other === value ? param.differentFrom.hint : null
}
