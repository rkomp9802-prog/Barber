import { formatDayMonth, formatWeekdayShort, tashkentDateKey } from '@barber/shared'

import { api } from '../client'
import { useRequest } from '../hooks/useRequest'
import { EmptyState, ErrorState, Skeleton } from './Status'

export const DAYS_AHEAD = 14

type Props = {
  serviceIds: readonly string[]
  barberId: string
  selected: string | null
  onSelect: (date: string) => void
}

export function DatePicker({ serviceIds, barberId, selected, onSelect }: Props) {
  const from = tashkentDateKey(new Date())
  const key = `${serviceIds.join(',')}|${barberId}|${from}`
  const days = useRequest(key, signal =>
    api.getAvailabilityDays({ serviceIds, barberId, from, days: DAYS_AHEAD }, signal),
  )

  if (days.status === 'loading') return <Skeleton rows={DAYS_AHEAD} variant="chip" label="Загружаем даты…" />
  if (days.status === 'error') return <ErrorState error={days.error} onRetry={days.reload} />
  if (!days.data.days.some(day => day.hasSlots)) {
    return <EmptyState title="В ближайшие две недели свободного времени нет" />
  }

  return (
    <div className="date-grid" role="radiogroup" aria-label="Дата">
      {days.data.days.map(day => (
        <button
          key={day.date}
          type="button"
          role="radio"
          aria-checked={selected === day.date}
          aria-label={`${formatDayMonth(day.date)}${day.hasSlots ? '' : ', нет свободного времени'}`}
          className={`date-chip${selected === day.date ? ' is-selected' : ''}`}
          disabled={!day.hasSlots}
          onClick={() => onSelect(day.date)}
        >
          <span className="date-weekday">{day.date === from ? 'сег' : formatWeekdayShort(day.date)}</span>
          <span className="date-day">{Number(day.date.slice(8, 10))}</span>
        </button>
      ))}
    </div>
  )
}
