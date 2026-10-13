/*
 * Выбор фото для секций главной (барберы, галерея). Чистые функции, без React и без next/image.
 */

/** Сколько стоковых портретов барберов лежит в /public/stock (barber-1..4). */
export const STOCK_BARBER_COUNT = 4

/** Сколько стоковых работ лежит в /public/stock (work-1..5). */
export const STOCK_WORK_COUNT = 5

/** Стоковый портрет барбера по порядковому номеру: barber-1..barber-4 по кругу. */
export function stockBarberSrc(index: number): string {
  const n = ((index % STOCK_BARBER_COUNT) + STOCK_BARBER_COUNT) % STOCK_BARBER_COUNT
  return `/stock/barber-${n + 1}.webp`
}

/** Фото барбера: его photoUrl, а если его нет — стоковый портрет по индексу. */
export function barberPhotoSrc(barber: { photoUrl: string | null }, index: number): string {
  const photo = barber.photoUrl?.trim()
  return photo ? photo : stockBarberSrc(index)
}

/** Фото галереи: все работы всех барберов; если работ нет — стоковые work-1..5. */
export function galleryItems(barbers: readonly { portfolio: readonly string[] }[]): string[] {
  const works = barbers.flatMap(barber => barber.portfolio).filter(src => src.trim() !== '')
  if (works.length > 0) return works
  return Array.from({ length: STOCK_WORK_COUNT }, (_, i) => `/stock/work-${i + 1}.webp`)
}

/** next/image оптимизирует только локальные файлы (с «/»); внешние URL отдаём как есть. */
export function isUnoptimizedSrc(src: string): boolean {
  return !src.startsWith('/')
}
