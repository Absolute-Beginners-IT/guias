import type { VlanPurpose } from '../domain/networkPlan'
import type { RiskLevel, StatusLevel, TaskGroup } from '../domain/schema'

export const GROUP_LABELS: Record<TaskGroup, string> = {
  'setup-access': 'Puesta en marcha y acceso',
  'vlans-ports': 'VLANs y puertos',
  monitoring: 'Monitorización',
  'security-resilience': 'Seguridad y resiliencia',
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Riesgo bajo',
  medium: 'Riesgo medio',
  high: 'Riesgo alto',
}

export const STATUS_LABELS: Record<StatusLevel, string> = {
  unverified: 'Sin verificar',
  'docs-checked': 'Contrastada con documentación',
  'lab-tested': 'Probada en equipo real',
}

export const PURPOSE_LABELS: Record<VlanPurpose, string> = {
  users: 'Usuarios',
  voice: 'Voz (telefonía IP)',
  servers: 'Servidores',
  guests: 'Invitados',
  cameras: 'Cámaras',
  management: 'Gestión',
  iot: 'Dispositivos IoT',
  other: 'Otro',
}
