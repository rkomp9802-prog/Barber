import { ADMIN_PAGE_SIZE_DEFAULT, type BookingSource, type BookingStatus } from '@barber/shared'

/** Вкладка списка записей: «Сегодня» (без фильтров) или «Все» (с пагинацией). */
export type BookingTab = 'today' | 'all'

/** Фильтры формы; пустая строка означает «не фильтровать». */
export type BookingFilters = {
  from: string
  to: string
  barberId: string
  status: BookingStatus | ''
  source: BookingSource | ''
  search: string
}

export const EMPTY_BOOKING_FILTERS: BookingFilters = {
  from: '',
  to: '',
  barberId: '',
  status: '',
  source: '',
  search: '',
}

/** Параметры GET /admin/bookings (как их передаёт клиент; status — список, сериализуется через запятую). */
export type AdminBookingsListQuery = {
  page: number
  pageSize: number
  order: 'asc' | 'desc'
  from?: string
  to?: string
  barberId?: string
  status?: readonly BookingStatus[]
  source?: BookingSource
  search?: string
}

function nonEmpty(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Превращает фильтры формы в параметры запроса; пустые поля отбрасываются. */
export function buildBookingsQuery(filters: BookingFilters, page: number): AdminBookingsListQuery {
  return {
    page,
    pageSize: ADMIN_PAGE_SIZE_DEFAULT,
    order: 'asc',
    from: nonEmpty(filters.from),
    to: nonEmpty(filters.to),
    barberId: nonEmpty(filters.barberId),
    status: filters.status === '' ? undefined : [filters.status],
    source: filters.source === '' ? undefined : filters.source,
    search: nonEmpty(filters.search),
  }
}

export function hasActiveBookingFilters(filters: BookingFilters): boolean {
  return Object.values(filters).some(value => value.trim() !== '')
}

/** Число страниц; пустой список — одна страница (чтобы подпись «1 из 1» была корректной). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
