import { formatDayMonth, formatLongDate, formatWeekdayShort } from '@barber/shared'

import styles from './Steps.module.css'
import type { DaysState } from './useAvailability'

type Props = {
  dateKeys: readonly string[]
  todayKey: string
  selected: string | null
  /** Какие дни свободны. Пока грузится или при ошибке — все дни доступны, сервер всё равно проверит. */
  days: DaysState
  onSelect: (dateKey: string) => void
}

/** «5 октября» → { day: '5', month: 'октября' }. */
function splitDayMonth(dateKey: string): { day: string; month: string } {
  const [day = '', ...rest] = formatDayMonth(dateKey).split(' ')
  return { day, month: rest.join(' ') }
}

function closedDays(days: DaysState): ReadonlySet<string> {
  if (days.status !== 'ready') return new Set()
  return new Set(days.data.filter(day => !day.hasSlots).map(day => day.date))
}

function statusText(days: DaysState, selected: string | null): string {
  if (selected) return `Выбрано: ${formatLongDate(selected)}`
  if (days.status === 'loading') return 'Проверяем свободные дни…'
  if (days.status === 'error') return 'Не удалось проверить свободные дни — выберите любой, время покажем на следующем шаге.'
  return 'Запись открыта на две недели вперёд. Серые дни — без свободного времени.'
}

type DayButtonProps = {
  dateKey: string
  badge: string
  isSelected: boolean
  isClosed: boolean
  onSelect: (dateKey: string) => void
}

function DayButton({ dateKey, badge, isSelected, isClosed, onSelect }: DayButtonProps) {
  const { day, month } = splitDayMonth(dateKey)
  const prefix = badge === formatWeekdayShort(dateKey) ? '' : `${badge}, `
  const suffix = isClosed ? ' — нет свободного времени' : ''
  return (
    <button
      type="button"
      className={`${styles.day} ${isSelected ? styles.selected : ''}`}
      aria-pressed={isSelected}
      aria-label={`${prefix}${formatLongDate(dateKey)}${suffix}`}
      disabled={isClosed && !isSelected}
      onClick={() => onSelect(dateKey)}
    >
      <span className={styles.dayWeek}>{badge}</span>
      <span className={styles.dayNum}>{day}</span>
      <span className={styles.dayMonth}>{month}</span>
    </button>
  )
}

export function DateStep({ dateKeys, todayKey, selected, days, onSelect }: Props) {
  const tomorrowKey = dateKeys[dateKeys.indexOf(todayKey) + 1]
  const closed = closedDays(days)

  return (
    <div className={styles.stack} aria-busy={days.status === 'loading'}>
      <ul className={styles.days} role="list" aria-label={`Ближайшие ${dateKeys.length} дней`}>
        {dateKeys.map(dateKey => {
          const badge = dateKey === todayKey ? 'Сегодня' : dateKey === tomorrowKey ? 'Завтра' : formatWeekdayShort(dateKey)
          return (
            <li key={dateKey}>
              <DayButton
                dateKey={dateKey}
                badge={badge}
                isSelected={dateKey === selected}
                isClosed={closed.has(dateKey)}
                onSelect={onSelect}
              />
            </li>
          )
        })}
      </ul>
      <p className={styles.totals} aria-live="polite">
        {statusText(days, selected)}
      </p>
    </div>
  )
}
