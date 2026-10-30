import { type ReactNode, useId } from 'react'

interface SectionProps {
  title: string
  children: ReactNode
  actions?: ReactNode
  /** Set when something else on the page needs to scroll to this section. */
  id?: string
}

export function Section({ title, children, actions, id }: SectionProps) {
  const headingId = useId()

  return (
    <section id={id} className="section" aria-labelledby={headingId}>
      <div className="section__header">
        <h2 id={headingId}>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}
