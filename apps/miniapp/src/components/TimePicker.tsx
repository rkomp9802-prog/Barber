import { formatLongDate, type SlotDto } from '@barber/shared'

import { api } from '../client'
import { useRequest } from '../hooks/useRequest'
import { EmptyState, ErrorState, Skeleton } from './Status'

type Props = {
  serviceIds: readonly string[]
  barberId: string
  date: string
  selected: SlotDto | null
  onSelect: (slot: SlotDto) => void
  /** Изменение значения заставляет перезагрузить слоты (например, после SLOT_TAKEN). */
  version: number
}

export function TimePicker({ serviceIds, barberId, date, selected, onSelect, version }: Props) {
  const key = `${serviceIds.join(',')}|${barberId}|${date}|${version}`
  const slots = useRequest(key, signal => api.getAvailability({ serviceIds, barberId, date }, signal))

  if (slots.status === 'loading') return <Skeleton rows={12} variant="chip" label="Загружаем свободное время…" />
  if (slots.status === 'error') return <ErrorState error={slots.error} onRetry={slots.reload} />
  if (slots.data.slots.length === 0) {
    return (
      <EmptyState title="На этот день свободного времени нет">
        <p className="muted">Вернитесь назад и выберите другую дату.</p>
      </EmptyState>
    )
  }

  return (
    <>
      <p className="hint">{formatLongDate(date)}</p>
      <div className="time-grid" role="radiogroup" aria-label="Время">
        {slots.data.slots.map(slot => {
          const isSelected = selected?.startsAt === slot.startsAt
          return (
            <button
              key={slot.startsAt}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`time-chip${isSelected ? ' is-selected' : ''}`}
              onClick={() => onSelect(slot)}
            >
              {slot.time}
            </button>
          )
        })}
      </div>
    </>
  )
}
