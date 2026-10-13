import { ANY_BARBER, plural, type BarberChoice, type BarberDto } from '@barber/shared'

import { BarberAvatar } from '@/components/ui/BarberAvatar'
import { Stars } from '@/components/ui/Stars'

import { qualifyingBarbers } from './bookingState'
import styles from './Steps.module.css'

type Props = {
  barbers: readonly BarberDto[]
  serviceIds: readonly string[]
  selected: BarberChoice | null
  onSelect: (barber: BarberChoice) => void
  onChangeServices: () => void
}

const ratingFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1 })

function experienceText(years: number): string {
  return `${years} ${plural(years, ['год', 'года', 'лет'])} опыта`
}

type CardProps = {
  barber: BarberDto
  index: number
  isSelected: boolean
  onSelect: (barber: BarberChoice) => void
}

function BarberCard({ barber, index, isSelected, onSelect }: CardProps) {
  const reviews = `${barber.reviewsCount} ${plural(barber.reviewsCount, ['отзыв', 'отзыва', 'отзывов'])}`
  return (
    <button
      type="button"
      className={`${styles.option} ${styles.barber} ${isSelected ? styles.selected : ''}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(barber.id)}
    >
      <BarberAvatar name={barber.name} photoUrl={barber.photoUrl} index={index} />
      <span className={styles.optionBody}>
        <span className={styles.optionTitle}>{barber.name}</span>
        <span className={styles.optionText}>
          {barber.role} · {experienceText(barber.experienceYears)}
        </span>
        <span className={styles.rating}>
          <Stars rating={barber.rating} />
          <span>
            {ratingFormatter.format(barber.rating)} · {reviews}
          </span>
        </span>
      </span>
      <span className={styles.check} aria-hidden="true" />
    </button>
  )
}

export function BarberStep({ barbers, serviceIds, selected, onSelect, onChangeServices }: Props) {
  const qualifying = qualifyingBarbers(barbers, serviceIds)

  if (qualifying.length === 0) {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeTitle}>Нет мастера на все выбранные услуги</p>
        <p className="muted">
          Ни один барбер не делает эту комбинацию за один визит. Уберите одну из услуг — или запишитесь на них
          отдельно.
        </p>
        <button type="button" className="btn btn-ghost" onClick={onChangeServices}>
          Изменить услуги
        </button>
      </div>
    )
  }

  const isAnySelected = selected === ANY_BARBER
  return (
    <ul className={styles.list} role="list">
      <li>
        <button
          type="button"
          className={`${styles.option} ${styles.barber} ${isAnySelected ? styles.selected : ''}`}
          aria-pressed={isAnySelected}
          onClick={() => onSelect(ANY_BARBER)}
        >
          <span className={styles.anyMark} aria-hidden="true">
            ✦
          </span>
          <span className={styles.optionBody}>
            <span className={styles.optionTitle}>Любой свободный</span>
            <span className={styles.optionText}>
              Подберём мастера, у которого есть время, — так больше свободных окон.
            </span>
          </span>
          <span className={styles.check} aria-hidden="true" />
        </button>
      </li>
      {qualifying.map(barber => (
        <li key={barber.id}>
          <BarberCard
            barber={barber}
            index={barbers.indexOf(barber)}
            isSelected={selected === barber.id}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  )
}
