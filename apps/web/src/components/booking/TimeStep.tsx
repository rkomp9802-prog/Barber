import { formatLongDate, plural, type BarberChoice } from '@barber/shared'

import type { BookingSource } from './bookingSource'
import styles from './Steps.module.css'
import type { SelectedSlot, SlotOption } from './types'
import { useSlots, type SlotsState } from './useAvailability'

const SKELETON_COUNT = 5

type Props = {
  source: BookingSource
  barber: BarberChoice
  serviceIds: readonly string[]
  dateKey: string
  dateKeys: readonly string[]
  selected: SelectedSlot | null
  /** Увеличьте, чтобы перезапросить слоты (например, после «время уже заняли»). */
  refreshKey?: number
  onSelect: (slot: SelectedSlot) => void
  onSelectDate: (dateKey: string) => void
  onPickAnotherDay: () => void
}

type DaySwitcherProps = {
  dateKey: string
  dateKeys: readonly string[]
  onSelectDate: (dateKey: string) => void
}

/** Быстрое переключение дня прямо на шаге времени. */
function DaySwitcher({ dateKey, dateKeys, onSelectDate }: DaySwitcherProps) {
  const index = dateKeys.indexOf(dateKey)
  const prev = dateKeys[index - 1]
  const next = dateKeys[index + 1]
  return (
    <div className={styles.daySwitcher}>
      <button
        type="button"
        className={styles.arrow}
        disabled={!prev}
        onClick={() => prev && onSelectDate(prev)}
        aria-label="Предыдущий день"
      >
        ←
      </button>
      <p className={styles.daySwitcherLabel}>{formatLongDate(dateKey)}</p>
      <button
        type="button"
        className={styles.arrow}
        disabled={!next}
        onClick={() => next && onSelectDate(next)}
        aria-label="Следующий день"
      >
        →
      </button>
    </div>
  )
}

type SlotsViewProps = {
  state: SlotsState
  selected: SelectedSlot | null
  onSelect: (slot: SelectedSlot) => void
  onRetry: () => void
  onPickAnotherDay: () => void
}

function SlotsView({ state, selected, onSelect, onRetry, onPickAnotherDay }: SlotsViewProps) {
  if (state.status === 'loading') {
    return (
      <ul className={styles.slots} aria-hidden="true">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <li key={i} className={styles.skeleton} />
        ))}
      </ul>
    )
  }
  if (state.status === 'error') {
    return (
      <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
        <p className={styles.noticeTitle}>Что-то пошло не так</p>
        <p className="muted">{state.message}</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Повторить
        </button>
      </div>
    )
  }
  if (state.data.length === 0) {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeTitle}>Нет свободного времени на этот день</p>
        <p className="muted">Попробуйте соседний день или выберите «Любой свободный» барбер.</p>
        <button type="button" className="btn btn-ghost" onClick={onPickAnotherDay}>
          Выбрать другой день
        </button>
      </div>
    )
  }
  return (
    <ul className={styles.slots} role="list" aria-label="Свободное время">
      {state.data.map(slot => (
        <li key={slot.startsAt}>
          <SlotButton slot={slot} isSelected={slot.startsAt === selected?.startsAt} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}

type SlotButtonProps = {
  slot: SlotOption
  isSelected: boolean
  onSelect: (slot: SelectedSlot) => void
}

function SlotButton({ slot, isSelected, onSelect }: SlotButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.slot} ${isSelected ? styles.selected : ''}`}
      aria-pressed={isSelected}
      onClick={() => onSelect({ time: slot.time, startsAt: slot.startsAt })}
    >
      {slot.time}
    </button>
  )
}

function liveMessage(state: SlotsState): string {
  if (state.status === 'loading') return 'Загружаем свободное время…'
  if (state.status === 'error') return ''
  const count = state.data.length
  return count === 0 ? 'Нет свободного времени на этот день' : `Свободно ${count} ${plural(count, ['окно', 'окна', 'окон'])}`
}

export function TimeStep(props: Props) {
  const { source, barber, serviceIds, dateKey, dateKeys, selected, refreshKey, onSelect, onSelectDate, onPickAnotherDay } =
    props
  const { state, retry } = useSlots(source, { serviceIds, barber, dateKey }, refreshKey)

  return (
    <div className={styles.stack} aria-busy={state.status === 'loading'}>
      <DaySwitcher dateKey={dateKey} dateKeys={dateKeys} onSelectDate={onSelectDate} />
      <p className="visually-hidden" aria-live="polite">
        {liveMessage(state)}
      </p>
      <SlotsView
        state={state}
        selected={selected}
        onSelect={onSelect}
        onRetry={retry}
        onPickAnotherDay={onPickAnotherDay}
      />
    </div>
  )
}
