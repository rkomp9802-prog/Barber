import { ANY_BARBER, formatDuration, formatPrice, type BarberChoice } from '@barber/shared'

import type { BookingSummary } from './bookingSummary'
import styles from './Form.module.css'
import { SummaryDetails } from './Summary'

type Props = {
  summary: BookingSummary
  barber: BarberChoice | null
  name: string
  phone: string
  error: string | undefined
}

export function ConfirmStep({ summary, barber, name, phone, error }: Props) {
  const barberNote = barber === ANY_BARBER ? 'Мастера назначим при подтверждении' : undefined

  return (
    <div className={styles.stack}>
      <div className={styles.review}>
        <SummaryDetails summary={summary} barberNote={barberNote} />
        <dl className={styles.reviewMeta}>
          <div>
            <dt>Клиент</dt>
            <dd>
              {name.trim()}
              <span className={styles.reviewPhone}>{phone}</span>
            </dd>
          </div>
          <div>
            <dt>Итого · {formatDuration(summary.durationMin)}</dt>
            <dd className={styles.price}>{formatPrice(summary.price)}</dd>
          </div>
        </dl>
      </div>
      <p className="muted">Оплата в барбершопе после визита — наличными или картой.</p>
      <p className="muted">
        После записи подтвердите её в Telegram: бот попросит поделиться номером. Нет Telegram — позвоните нам.
      </p>
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
