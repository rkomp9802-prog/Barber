import type { AdminScheduleInput, WeeklyRangeDto } from '@barber/shared'
import { containsRange } from '../../domain/intervals'
import { parseHhmm, type Interval } from '../../domain/time'

/** Одна проблема графика: путь в теле запроса и текст для владельца. */
export type ScheduleIssue = { readonly path: string; readonly message: string }

type ListName = 'workingHours' | 'breaks'

function toInterval(range: WeeklyRangeDto): Interval {
  return { start: parseHhmm(range.startTime), end: parseHhmm(range.endTime) }
}

function isValidRange(range: WeeklyRangeDto): boolean {
  const interval = toInterval(range)
  return interval.start < interval.end
}

function sameDayOverlap(a: WeeklyRangeDto, b: WeeklyRangeDto): boolean {
  if (a.weekday !== b.weekday) return false
  const first = toInterval(a)
  const second = toInterval(b)
  return first.start < second.end && second.start < first.end
}

function orderIssues(list: ListName, ranges: readonly WeeklyRangeDto[]): ScheduleIssue[] {
  return ranges.flatMap((range, index) =>
    isValidRange(range) ? [] : [{ path: `${list}.${index}`, message: 'Начало должно быть раньше конца' }],
  )
}

function overlapIssues(list: ListName, ranges: readonly WeeklyRangeDto[]): ScheduleIssue[] {
  return ranges.flatMap((later, index) => {
    const clashes = ranges.slice(0, index).some(earlier => sameDayOverlap(earlier, later))
    return clashes ? [{ path: `${list}.${index}`, message: 'Промежутки одного дня пересекаются' }] : []
  })
}

function breakIssues(schedule: AdminScheduleInput): ScheduleIssue[] {
  return schedule.breaks.flatMap((owned, index) => {
    if (!isValidRange(owned)) return []
    const shifts = schedule.workingHours
      .filter(shift => shift.weekday === owned.weekday && isValidRange(shift))
      .map(toInterval)
    const interval = toInterval(owned)
    if (containsRange(shifts, interval.start, interval.end)) return []
    return [{ path: `breaks.${index}`, message: 'Обед должен лежать внутри рабочей смены этого дня' }]
  })
}

/**
 * Проверки недельного графика (spec §5, этап 9): start < end; смены одного дня не пересекаются;
 * обеды не пересекаются; каждый обед внутри смены своего дня. Пустой список — график корректен.
 */
export function validateSchedule(schedule: AdminScheduleInput): ScheduleIssue[] {
  return [
    ...orderIssues('workingHours', schedule.workingHours),
    ...orderIssues('breaks', schedule.breaks),
    ...overlapIssues('workingHours', schedule.workingHours),
    ...overlapIssues('breaks', schedule.breaks),
    ...breakIssues(schedule),
  ]
}
