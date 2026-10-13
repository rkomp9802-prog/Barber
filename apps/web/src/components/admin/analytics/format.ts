const percentFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

/** 12.5 → «12,5%». */
export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`
}

/** Значение в диапазон 0..100 для ширины полосы. */
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}
