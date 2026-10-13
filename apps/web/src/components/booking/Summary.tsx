import { useId, useState } from 'react'

import { formatDuration, formatLongDate, formatPrice, plural } from '@barber/shared'

import type { BookingSummary } from './bookingSummary'
import styles from './Summary.module.css'

const PLACEHOLDER = 'Не выбрано'

type DetailsProps = {
  summary: BookingSummary
  /** Подзаголовки вроде «Барбер» при выбранном «Любой свободный» на подтверждении. */
  barberNote?: string
}

/** Список выбранного: используется в боковой панели, нижней панели и на подтверждении. */
export function SummaryDetails({ summary, barberNote }: DetailsProps) {
  const { services, barberName, dateKey, time } = summary
  return (
    <dl className={styles.details}>
      <div className={styles.row}>
        <dt>Услуги</dt>
        <dd>
          {services.length === 0 ? (
            <span className={styles.empty}>{PLACEHOLDER}</span>
          ) : (
            <ul className={styles.services}>
              {services.map(service => (
                <li key={service.id}>
                  <span>{service.name}</span>
                  <span className={styles.servicePrice}>{formatPrice(service.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </dd>
      </div>
      <div className={styles.row}>
        <dt>Барбер</dt>
        <dd>
          {barberName ?? <span className={styles.empty}>{PLACEHOLDER}</span>}
          {barberNote && <span className={styles.note}>{barberNote}</span>}
        </dd>
      </div>
      <div className={styles.row}>
        <dt>Дата и время</dt>
        <dd>
          {dateKey ? formatLongDate(dateKey) : <span className={styles.empty}>{PLACEHOLDER}</span>}
          {time && <span className={styles.time}>{time}</span>}
        </dd>
      </div>
    </dl>
  )
}

function TotalLine({ summary }: { summary: BookingSummary }) {
  if (summary.services.length === 0) return <span className={styles.totalEmpty}>Выберите услугу</span>
  return (
    <span className={styles.total}>
      <span className={styles.totalPrice}>{formatPrice(summary.price)}</span>
      <span className={styles.totalMeta}>{formatDuration(summary.durationMin)}</span>
    </span>
  )
}

type Props = {
  summary: BookingSummary
}

/** Боковая панель на десктопе. */
export function SummaryPanel({ summary }: Props) {
  return (
    <section className={styles.panel} aria-labelledby="summary-title">
      <p className="eyebrow">Ваша запись</p>
      <h2 id="summary-title" className={styles.panelTitle}>
        Sharp Barbershop
      </h2>
      <SummaryDetails summary={summary} />
      <div className={styles.footer}>
        <span className={styles.footerLabel}>Итого</span>
        <TotalLine summary={summary} />
      </div>
    </section>
  )
}

/** Сворачиваемая нижняя панель на телефоне. */
export function MobileSummary({ summary }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const detailsId = useId()
  const count = summary.services.length
  const label = count === 0 ? 'Ваша запись' : `${count} ${plural(count, ['услуга', 'услуги', 'услуг'])}`

  return (
    <div className={styles.mobile}>
      <div id={detailsId} className={styles.mobileDetails} hidden={!isOpen}>
        <SummaryDetails summary={summary} />
      </div>
      <button
        type="button"
        className={styles.mobileToggle}
        aria-expanded={isOpen}
        aria-controls={detailsId}
        onClick={() => setIsOpen(open => !open)}
      >
        <span className={styles.mobileLabel}>
          {label}
          <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true" />
          <span className="visually-hidden">{isOpen ? ', скрыть детали' : ', показать детали'}</span>
        </span>
        <TotalLine summary={summary} />
      </button>
    </div>
  )
}
