interface BadgeProps {
  label: string
  tone: 'ok' | 'warn' | 'danger' | 'neutral'
}

export function Badge({ label, tone }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{label}</span>
}
