import {
  formatDuration,
  formatPrice,
  plural,
  selectedServices,
  totalDurationMin,
  totalPrice,
  type ServiceDto,
} from '@barber/shared'

import styles from './Steps.module.css'

type Props = {
  services: readonly ServiceDto[]
  serviceIds: readonly string[]
  onToggle: (id: string) => void
}

export function ServiceStep({ services, serviceIds, onToggle }: Props) {
  const chosen = selectedServices(services, serviceIds)
  const totals =
    chosen.length === 0
      ? 'Можно выбрать несколько услуг — например, стрижку и бритьё.'
      : `Выбрано ${chosen.length} ${plural(chosen.length, ['услуга', 'услуги', 'услуг'])} · ${formatDuration(totalDurationMin(chosen))} · ${formatPrice(totalPrice(chosen))}`

  return (
    <div className={styles.stack}>
      <ul className={styles.list} role="list">
        {services.map(service => {
          const isSelected = serviceIds.includes(service.id)
          return (
            <li key={service.id}>
              <button
                type="button"
                className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                aria-pressed={isSelected}
                onClick={() => onToggle(service.id)}
              >
                <span className={styles.check} aria-hidden="true" />
                <span className={styles.optionBody}>
                  <span className={styles.optionTitle}>{service.name}</span>
                  <span className={styles.optionText}>{service.description}</span>
                </span>
                <span className={styles.optionMeta}>
                  <span className={styles.price}>{formatPrice(service.price)}</span>
                  <span className={styles.duration}>{formatDuration(service.durationMin)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className={styles.totals} aria-live="polite">
        {totals}
      </p>
    </div>
  )
}
