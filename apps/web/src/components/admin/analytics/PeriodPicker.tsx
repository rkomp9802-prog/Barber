'use client'

import { useEffect, useState } from 'react'

import {
  PERIOD_PRESETS,
  matchPreset,
  presetRange,
  validatePeriod,
  type DateRange,
} from '@/lib/admin/analyticsPeriod'

import styles from './analytics.module.css'

type PeriodPickerProps = {
  range: DateRange
  onChange: (range: DateRange) => void
}

/** Быстрые периоды и поля дат. Некорректный период не отправляется, а показывается ошибка. */
export function PeriodPicker({ range, onChange }: PeriodPickerProps) {
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)

  // Черновик полей следует за периодом, когда тот меняется кнопкой.
  useEffect(() => {
    setFrom(range.from)
    setTo(range.to)
  }, [range.from, range.to])

  const activePreset = matchPreset(range, new Date())
  const error = validatePeriod({ from, to })

  function changeDates(next: DateRange) {
    setFrom(next.from)
    setTo(next.to)
    if (validatePeriod(next) === null) onChange(next)
  }

  return (
    <div className={styles.period}>
      <div className={styles.presets} role="group" aria-label="Быстрый выбор периода">
        {PERIOD_PRESETS.map(item => {
          const active = item.value === activePreset
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              className={`${styles.preset} ${active ? styles.presetActive : ''}`}
              onClick={() => onChange(presetRange(item.value, new Date()))}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div className={styles.dates}>
        <label className={styles.field}>
          <span>Начало периода</span>
          <input type="date" value={from} onChange={event => changeDates({ from: event.target.value, to })} />
        </label>
        <label className={styles.field}>
          <span>Конец периода</span>
          <input type="date" value={to} onChange={event => changeDates({ from, to: event.target.value })} />
        </label>
      </div>
      {error ? (
        <p className={styles.periodError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
