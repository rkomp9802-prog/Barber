import type { HeatmapCellDto } from '@barber/shared'

/*
 * Подготовка данных для heatmap «день недели × час». Сервер присылает только непустые ячейки,
 * здесь они раскладываются в сетку: строки — дни (пн первый), колонки — часы от первого
 * до последнего часа с данными.
 */

export const WEEKDAYS: readonly { short: string; full: string }[] = [
  { short: 'пн', full: 'понедельник' },
  { short: 'вт', full: 'вторник' },
  { short: 'ср', full: 'среда' },
  { short: 'чт', full: 'четверг' },
  { short: 'пт', full: 'пятница' },
  { short: 'сб', full: 'суббота' },
  { short: 'вс', full: 'воскресенье' },
]

export type HeatmapGrid = {
  /** Часы-колонки: от минимального до максимального часа с данными, подряд. */
  hours: number[]
  /** По строке на день недели; counts выровнены по hours. */
  days: { short: string; full: string; counts: number[] }[]
  /** Максимум по всей сетке, нужен для шкалы интенсивности. */
  max: number
  /** Сумма записей по сетке. 0 — данных нет. */
  total: number
}

function isValidCell(cell: HeatmapCellDto): boolean {
  return (
    Number.isInteger(cell.dayOfWeek) &&
    cell.dayOfWeek >= 0 &&
    cell.dayOfWeek <= 6 &&
    Number.isInteger(cell.hour) &&
    cell.hour >= 0 &&
    cell.hour <= 23
  )
}

export function buildHeatmapGrid(cells: readonly HeatmapCellDto[]): HeatmapGrid {
  const valid = cells.filter(isValidCell)
  if (valid.length === 0) {
    return { hours: [], days: WEEKDAYS.map(day => ({ ...day, counts: [] })), max: 0, total: 0 }
  }

  let minHour = Infinity
  let maxHour = -Infinity
  for (const cell of valid) {
    minHour = Math.min(minHour, cell.hour)
    maxHour = Math.max(maxHour, cell.hour)
  }

  const hours: number[] = []
  for (let hour = minHour; hour <= maxHour; hour += 1) hours.push(hour)

  const days = WEEKDAYS.map(day => ({ ...day, counts: hours.map(() => 0) }))
  for (const cell of valid) {
    const day = days[cell.dayOfWeek]
    const index = cell.hour - minHour
    if (day) day.counts[index] = (day.counts[index] ?? 0) + cell.bookingsCount
  }

  let max = 0
  let total = 0
  for (const day of days) {
    for (const count of day.counts) {
      max = Math.max(max, count)
      total += count
    }
  }

  return { hours, days, max, total }
}

/** Доля интенсивности 0..1 для CSS. Ненулевая ячейка всегда заметна (не меньше 0.15). */
export function intensityOf(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0
  return Math.min(1, Math.max(count / max, 0.15))
}
