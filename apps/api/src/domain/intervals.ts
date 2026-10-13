import type { Interval } from './time'

/** Убирает пустые интервалы и сортирует по началу. Исходный массив не меняется. */
export function normalize(intervals: readonly Interval[]): Interval[] {
  return intervals.filter(interval => interval.end > interval.start).toSorted((a, b) => a.start - b.start)
}

/** Объединяет пересекающиеся и соприкасающиеся интервалы. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  return normalize(intervals).reduce<Interval[]>((merged, current) => {
    const last = merged.at(-1)
    if (last && current.start <= last.end) {
      return [...merged.slice(0, -1), { start: last.start, end: Math.max(last.end, current.end) }]
    }
    return [...merged, current]
  }, [])
}

/** Вычитает из одного интервала набор «вырезов». */
function subtractFromOne(base: Interval, cuts: readonly Interval[]): Interval[] {
  const pieces: Interval[] = []
  let cursor = base.start
  for (const cut of cuts) {
    if (cut.end <= cursor || cut.start >= base.end) continue
    if (cut.start > cursor) pieces.push({ start: cursor, end: Math.min(cut.start, base.end) })
    cursor = Math.max(cursor, cut.end)
    if (cursor >= base.end) break
  }
  if (cursor < base.end) pieces.push({ start: cursor, end: base.end })
  return pieces
}

/** base минус cuts: части base, не покрытые ни одним вырезом. */
export function subtractIntervals(base: readonly Interval[], cuts: readonly Interval[]): Interval[] {
  const sortedCuts = mergeIntervals(cuts)
  return mergeIntervals(base).flatMap(interval => subtractFromOne(interval, sortedCuts))
}

/** Целиком ли [start, end) лежит внутри одного из интервалов. */
export function containsRange(intervals: readonly Interval[], start: number, end: number): boolean {
  return intervals.some(interval => interval.start <= start && end <= interval.end)
}

/** Пересекается ли [start, end) хотя бы с одним интервалом (границы полуоткрытые). */
export function overlapsAny(intervals: readonly Interval[], start: number, end: number): boolean {
  return intervals.some(interval => interval.start < end && start < interval.end)
}
