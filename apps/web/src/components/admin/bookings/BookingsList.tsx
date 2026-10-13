import Link from 'next/link'

import type { AdminBookingDto } from '@barber/shared'

import { toBookingView, type BookingView } from '@/lib/admin/bookingView'

import { EmptyBlock } from '../StateBlocks'
import { BookingStatusBadge } from './BookingStatusBadge'
import styles from './bookings.module.css'

type Props = {
  bookings: readonly AdminBookingDto[]
  emptyText: string
}

/** Таблица на широком экране и карточки на узком; данные одни и те же. */
export function BookingsList({ bookings, emptyText }: Props) {
  if (bookings.length === 0) return <EmptyBlock text={emptyText} />
  const views = bookings.map(toBookingView)
  return (
    <>
      <BookingsTable views={views} />
      <ul className={styles.cards}>
        {views.map(view => (
          <li key={view.id}>
            <BookingCard view={view} />
          </li>
        ))}
      </ul>
    </>
  )
}

function BookingsTable({ views }: { views: readonly BookingView[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Время</th>
            <th scope="col">Клиент</th>
            <th scope="col">Барбер</th>
            <th scope="col">Услуги</th>
            <th scope="col" className={styles.numeric}>
              Сумма
            </th>
            <th scope="col">Статус</th>
            <th scope="col">Источник</th>
          </tr>
        </thead>
        <tbody>
          {views.map(view => (
            <tr key={view.id}>
              <td className={styles.nowrap}>
                <Link href={`/admin/bookings/${view.id}`} className={styles.rowLink}>
                  <span className={styles.day}>{view.day}</span>
                  <span>{view.timeRange}</span>
                </Link>
              </td>
              <td>
                <span className={styles.strong}>{view.clientName}</span>
                <span className={`${styles.subtle} muted`}>{view.clientPhone}</span>
              </td>
              <td>{view.barberName}</td>
              <td className={styles.services}>{view.servicesText}</td>
              <td className={styles.numeric}>{view.total}</td>
              <td>
                <BookingStatusBadge label={view.statusLabel} tone={view.statusTone} />
              </td>
              <td className={styles.nowrap}>{view.sourceLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BookingCard({ view }: { view: BookingView }) {
  return (
    <Link href={`/admin/bookings/${view.id}`} className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.day}>
          {view.day}, {view.timeRange}
        </span>
        <BookingStatusBadge label={view.statusLabel} tone={view.statusTone} />
      </div>
      <span className={styles.strong}>{view.clientName}</span>
      <span className="muted">{view.clientPhone}</span>
      <span>
        {view.barberName} · {view.servicesText}
      </span>
      <div className={styles.cardBottom}>
        <span className={styles.strong}>{view.total}</span>
        <span className={styles.subtle}>{view.sourceLabel}</span>
      </div>
    </Link>
  )
}
