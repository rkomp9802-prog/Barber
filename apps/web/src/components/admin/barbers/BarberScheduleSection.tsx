'use client'

import { useState } from 'react'

import type { AdminBarberDto } from '@barber/shared'

import { setBarberSchedule } from '@/lib/adminApi'
import {
  WEEKDAY_NAMES,
  WEEKDAY_ORDER,
  buildScheduleInput,
  scheduleToDays,
  type DaySchedule,
  type TimeRange,
} from '@/lib/admin/barbersSchedule'
import { barberErrorMessage } from '@/lib/admin/barbersView'

import { NoticeLine, Panel, type Notice } from './BarberUi'
import styles from './barbers.module.css'

type Props = {
  barber: AdminBarberDto
  onChange: (barber: AdminBarberDto) => void
}

type RangeKind = 'shifts' | 'breaks'

const DEFAULT_SHIFT: TimeRange = { startTime: '10:00', endTime: '19:00' }
const DEFAULT_BREAK: TimeRange = { startTime: '13:00', endTime: '14:00' }

export function BarberScheduleSection({ barber, onChange }: Props) {
  const [days, setDays] = useState<DaySchedule[]>(() => scheduleToDays(barber.schedule))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  function updateDay(weekday: number, change: (day: DaySchedule) => DaySchedule) {
    setDays(current => current.map(day => (day.weekday === weekday ? change(day) : day)))
  }

  function addRange(weekday: number, kind: RangeKind) {
    updateDay(weekday, day => ({
      ...day,
      [kind]: [...day[kind], kind === 'shifts' ? DEFAULT_SHIFT : DEFAULT_BREAK],
    }))
  }

  function changeRange(weekday: number, kind: RangeKind, index: number, patch: Partial<TimeRange>) {
    updateDay(weekday, day => ({
      ...day,
      [kind]: day[kind].map((range, position) => (position === index ? { ...range, ...patch } : range)),
    }))
  }

  function removeRange(weekday: number, kind: RangeKind, index: number) {
    updateDay(weekday, day => ({
      ...day,
      [kind]: day[kind].filter((_, position) => position !== index),
    }))
  }

  async function save() {
    const checked = buildScheduleInput(days)
    if (!checked.ok) {
      setNotice({ tone: 'error', text: checked.error })
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const updated = await setBarberSchedule(barber.id, checked.value)
      onChange(updated)
      setDays(scheduleToDays(updated.schedule))
      setNotice({ tone: 'ok', text: 'График сохранён.' })
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: barberErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel id="barber-schedule" title="График" hint="Время по Ташкенту. Обед должен быть внутри смены этого дня.">
      <div className={styles.days}>
        {WEEKDAY_ORDER.map(weekday => {
          const day = days.find(item => item.weekday === weekday)
          if (!day) return null
          const name = WEEKDAY_NAMES[weekday] ?? ''
          return (
            <div key={weekday} className={styles.day}>
              <h3 className={styles.dayTitle}>{name}</h3>
              <RangeList
                label="Смены"
                ranges={day.shifts}
                disabled={saving}
                addLabel="+ Смена"
                dayName={name}
                onAdd={() => addRange(weekday, 'shifts')}
                onChange={(index, patch) => changeRange(weekday, 'shifts', index, patch)}
                onRemove={index => removeRange(weekday, 'shifts', index)}
              />
              <RangeList
                label="Обеды"
                ranges={day.breaks}
                disabled={saving}
                addLabel="+ Обед"
                dayName={name}
                onAdd={() => addRange(weekday, 'breaks')}
                onChange={(index, patch) => changeRange(weekday, 'breaks', index, patch)}
                onRemove={index => removeRange(weekday, 'breaks', index)}
              />
            </div>
          )
        })}
      </div>
      <NoticeLine notice={notice} />
      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Сохраняем…' : 'Сохранить график'}
        </button>
      </div>
    </Panel>
  )
}

type RangeListProps = {
  label: string
  ranges: readonly TimeRange[]
  disabled: boolean
  addLabel: string
  dayName: string
  onAdd: () => void
  onChange: (index: number, patch: Partial<TimeRange>) => void
  onRemove: (index: number) => void
}

function RangeList({ label, ranges, disabled, addLabel, dayName, onAdd, onChange, onRemove }: RangeListProps) {
  return (
    <div className={styles.rangeGroup}>
      <span className={styles.rangeLabel}>{label}</span>
      {ranges.length === 0 ? <span className="muted">Нет</span> : null}
      {ranges.map((range, index) => (
        <div key={index} className={styles.rangeRow}>
          <input
            type="time"
            aria-label={`${label}: начало, ${dayName}`}
            className={styles.input}
            value={range.startTime}
            disabled={disabled}
            onChange={event => onChange(index, { startTime: event.target.value })}
          />
          <span aria-hidden="true">–</span>
          <input
            type="time"
            aria-label={`${label}: конец, ${dayName}`}
            className={styles.input}
            value={range.endTime}
            disabled={disabled}
            onChange={event => onChange(index, { endTime: event.target.value })}
          />
          <button
            type="button"
            className={`btn btn-ghost ${styles.smallButton}`}
            disabled={disabled}
            aria-label={`Удалить: ${label.toLowerCase()} ${dayName}, ${index + 1}`}
            onClick={() => onRemove(index)}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={`btn btn-ghost ${styles.smallButton}`} disabled={disabled} onClick={onAdd}>
        {addLabel}
      </button>
    </div>
  )
}
