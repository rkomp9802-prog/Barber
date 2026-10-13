import { formatPrice, plural } from '@barber/shared'
import type { CancellationsAnalyticsDto, RetentionAnalyticsDto, RevenueAnalyticsDto } from '@barber/shared'

import { formatPercent } from './format'
import styles from './analytics.module.css'

type SummaryCardsProps = {
  revenue: RevenueAnalyticsDto
  cancellations: CancellationsAnalyticsDto
  retention: RetentionAnalyticsDto
}

type Card = { key: string; label: string; value: string; hint: string }

export function SummaryCards({ revenue, cancellations, retention }: SummaryCardsProps) {
  const cards: Card[] = [
    {
      key: 'revenue',
      label: 'Выручка',
      value: formatPrice(revenue.totalRevenue),
      hint: 'по завершённым записям',
    },
    {
      key: 'completed',
      label: 'Завершённые записи',
      value: String(revenue.completedCount),
      hint: plural(revenue.completedCount, ['запись', 'записи', 'записей']),
    },
    {
      key: 'average',
      label: 'Средний чек',
      value: formatPrice(revenue.averageCheck),
      hint: 'на одну завершённую запись',
    },
    {
      key: 'cancelled',
      label: 'Отмены',
      value: String(cancellations.cancelledCount),
      hint: `${formatPercent(cancellations.cancelledPercent)} от ${cancellations.totalBookings} ${plural(cancellations.totalBookings, ['запись', 'записи', 'записей'])}`,
    },
    {
      key: 'noshow',
      label: 'Неявки',
      value: String(cancellations.noShowCount),
      hint: `${formatPercent(cancellations.noShowPercent)} от всех записей`,
    },
    {
      key: 'retention',
      label: 'Возвращаемость',
      value: formatPercent(retention.retentionRate),
      hint: `разовые: ${retention.oneTimeClients} · вернувшиеся: ${retention.returningClients}`,
    },
  ]

  return (
    <ul className={styles.cards}>
      {cards.map(card => (
        <li key={card.key} className={styles.card}>
          <span className={styles.cardLabel}>{card.label}</span>
          <strong className={styles.cardValue}>{card.value}</strong>
          <span className={styles.cardHint}>{card.hint}</span>
        </li>
      ))}
    </ul>
  )
}
