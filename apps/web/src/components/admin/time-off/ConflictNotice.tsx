import Link from 'next/link'

import type { AdminTimeOffResultDto } from '@barber/shared'

import { toBookingView } from '@/lib/admin/bookingView'

import styles from './time-off.module.css'

type Props = {
  result: AdminTimeOffResultDto
  onDismiss: () => void
}

/** Предупреждение: исключение пересекается с подтверждёнными записями, их нужно решить вручную. */
export function ConflictNotice({ result, onDismiss }: Props) {
  const views = result.conflicts.map(toBookingView)
  const count = views.length

  return (
    <section className={styles.conflicts} role="alert" aria-labelledby="conflicts-title">
      <div className={styles.conflictsHeader}>
        <h2 id="conflicts-title" className={styles.subtitle}>
          Исключение пересекается с записями: {count}
        </h2>
        <button type="button" className="btn btn-ghost" onClick={onDismiss}>
          Скрыть
        </button>
      </div>
      <p>
        Исключение сохранено, но записи клиентов не отменились автоматически. Перенесите или отмените их вручную.
      </p>
      <ul className={styles.conflictList}>
        {views.map(view => (
          <li key={view.id}>
            <Link href={`/admin/bookings/${view.id}`} className={styles.conflictLink}>
              <span className={styles.strong}>
                {view.day}, {view.timeRange}
              </span>
              <span>
                {view.clientName} · {view.clientPhone}
              </span>
              <span className="muted">
                {view.barberName} · {view.servicesText}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
