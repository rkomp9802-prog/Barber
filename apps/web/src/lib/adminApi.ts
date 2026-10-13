import type {
  AdminBookingCreateInput,
  AdminBookingDto,
  AdminBookingUpdateInput,
  AdminLoginInput,
  AdminMeDto,
  AdminReviewDto,
  AdminReviewUpdateInput,
  AdminReviewsQuery,
  AdminSettingsDto,
  AdminSettingsInput,
  AdminUploadDto,
  AdminUploadInput,
  Paginated,
} from '@barber/shared'

import { ApiRequestError, send } from './api'
import type { AdminBookingsListQuery } from './admin/bookingsQuery'
import { adminJson, adminVoid, toQueryString } from './admin/request'

export * from './admin/catalogApi'
export type { AdminBookingsListQuery } from './admin/bookingsQuery'

/*
 * Типизированный браузерный клиент админского API (/api/v1/admin). Каталог, исключения
 * и барберы — в ./admin/catalogApi. Ошибки — ApiRequestError (см. lib/api.ts).
 */

/* ---------- Авторизация ---------- */

export function login(input: AdminLoginInput): Promise<AdminMeDto> {
  return adminJson<AdminMeDto>('/login', { method: 'POST', body: input })
}

export function logout(): Promise<void> {
  return adminVoid('/logout', { method: 'POST' })
}

export function me(): Promise<AdminMeDto> {
  return adminJson<AdminMeDto>('/me')
}

/* ---------- Записи ---------- */

function bookingsSearch(query: AdminBookingsListQuery): string {
  return toQueryString({ ...query, status: query.status?.join(',') })
}

export function listBookings(query: AdminBookingsListQuery): Promise<Paginated<AdminBookingDto>> {
  return adminJson<Paginated<AdminBookingDto>>('/bookings', { query: bookingsSearch(query) })
}

export function listTodayBookings(): Promise<AdminBookingDto[]> {
  return adminJson<AdminBookingDto[]>('/bookings/today')
}

export function getBooking(id: string): Promise<AdminBookingDto> {
  return adminJson<AdminBookingDto>(`/bookings/${encodeURIComponent(id)}`)
}

export function createBooking(input: AdminBookingCreateInput): Promise<AdminBookingDto> {
  return adminJson<AdminBookingDto>('/bookings', { method: 'POST', body: input })
}

export function updateBooking(id: string, input: AdminBookingUpdateInput): Promise<AdminBookingDto> {
  return adminJson<AdminBookingDto>(`/bookings/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })
}

/* ---------- Отзывы ---------- */

export function listReviews(query: AdminReviewsQuery): Promise<Paginated<AdminReviewDto>> {
  return adminJson<Paginated<AdminReviewDto>>('/reviews', { query: toQueryString(query) })
}

export function updateReview(id: string, input: AdminReviewUpdateInput): Promise<AdminReviewDto> {
  return adminJson<AdminReviewDto>(`/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })
}

/* ---------- Настройки ---------- */

export function getSettings(): Promise<AdminSettingsDto> {
  return adminJson<AdminSettingsDto>('/settings')
}

export function updateSettings(input: AdminSettingsInput): Promise<AdminSettingsDto> {
  return adminJson<AdminSettingsDto>('/settings', { method: 'PUT', body: input })
}

/* ---------- Загрузка файлов ---------- */

/** Запрашивает подписанный URL (POST /uploads). */
export function createUpload(input: AdminUploadInput): Promise<AdminUploadDto> {
  return adminJson<AdminUploadDto>('/uploads', { method: 'POST', body: input })
}

/** PUT файла на подписанный URL из createUpload; без cookie и без CSRF — это запрос к Storage. */
async function putFile(upload: AdminUploadDto, file: Blob, contentType: string): Promise<void> {
  const response = await send(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: file,
  })
  if (!response.ok) throw new ApiRequestError('INTERNAL', 'Не удалось загрузить файл', response.status)
}

/** Полный цикл: подпись → PUT файла → публичный URL для сохранения в барбера или портфолио. */
export async function uploadFile(input: AdminUploadInput, file: Blob): Promise<AdminUploadDto> {
  const upload = await createUpload(input)
  await putFile(upload, file, input.contentType)
  return upload
}
