import type { ReactNode } from 'react'

export type SummaryItem = { label: string; value: ReactNode }

type Props = { items: readonly SummaryItem[] }

/** Таблица «название — значение» в виде секции Telegram. */
export function SummaryList({ items }: Props) {
  return (
    <dl className="summary-list">
      {items.map(item => (
        <div key={item.label} className="summary-row">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
