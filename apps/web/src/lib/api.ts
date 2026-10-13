import {
  API_ERROR_CODES,
  API_PREFIX,
  type ApiErrorCode,
  type AvailabilityDaysResponse,
  type AvailabilityResponse,
  type BarberDto,
  type BookingDto,
  type CreateBookingInput,
  type PublicReviewDto,
  type ServiceDto,
} from '@barber/shared'

/*
 * Типизированный клиент REST API /api/v1 (spec §8). Работает и на сервере (Server Components),
 * и в браузере. Любая неудача превращается в ApiRequestError с кодом из контракта,
 * а отмена через AbortSignal пробрасывается как есть (DOMException AbortError).
 */

export const DEFAULT_API_URL = 'http://localhost:4000'

/** Код ошибки: из контракта API или NETWORK_ERROR, если сервер не ответил. */
export type ApiRequestErrorCode = ApiErrorCode | 'NETWORK_ERROR'

export class ApiRequestError extends Error {
  readonly code: ApiRequestErrorCode
  /** HTTP-статус; 0 — ответа не было (сеть, таймаут, CORS). */
  readonly status: number
  readonly details?: unknown

  constructor(code: ApiRequestErrorCode, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function isApiRequestError(error: unknown, code?: ApiRequestErrorCode): error is ApiRequestError {
  return error instanceof ApiRequestError && (code === undefined || error.code === code)
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** На сервере — API_URL (внутренний адрес), в браузере — NEXT_PUBLIC_API_URL. */
export function apiBaseUrl(): string {
  const configured =
    typeof window === 'undefined'
      ? (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL)
      : process.env.NEXT_PUBLIC_API_URL
  return (configured?.trim() || DEFAULT_API_URL).replace(/\/+$/, '')
}

export type RequestOptions = {
  signal?: AbortSignal
  /** Только на сервере: кеш Next.js (no-store для персональных данных). */
  cache?: RequestCache
  /** Только на сервере: перепроверять кеш не чаще, чем раз в N секунд. */
  revalidate?: number
}

type HttpRequest = RequestOptions & {
  method?: 'GET' | 'POST'
  body?: unknown
}

const FALLBACK_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз'
const NETWORK_MESSAGE = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз'

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value)
}

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 404) return 'NOT_FOUND'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 400 && status < 500) return 'VALIDATION_ERROR'
  return 'INTERNAL'
}

/** Тело ошибки — чужие данные: читаем его осторожно и не доверяем форме. */
export async function parseErrorResponse(response: Response): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(() => null)
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const code = isApiErrorCode(record.code) ? record.code : codeFromStatus(response.status)
  const message = typeof record.message === 'string' && record.message ? record.message : FALLBACK_MESSAGE
  return new ApiRequestError(code, message, response.status, record.details)
}

function buildInit({ method = 'GET', body, signal, cache, revalidate }: HttpRequest): RequestInit {
  const init: RequestInit = {
    method,
    signal,
    headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
  if (cache) return { ...init, cache }
  if (revalidate !== undefined) return { ...init, next: { revalidate } }
  return init
}

/** fetch с переводом сетевой ошибки в NETWORK_ERROR (отмена пробрасывается как есть). */
export async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error: unknown) {
    if (isAbortError(error)) throw error
    throw new ApiRequestError('NETWORK_ERROR', NETWORK_MESSAGE, 0)
  }
}

export async function request<T>(path: string, options: HttpRequest = {}): Promise<T> {
  const response = await send(`${apiBaseUrl()}${API_PREFIX}${path}`, buildInit(options))
  if (!response.ok) throw await parseErrorResponse(response)
  try {
    return (await response.json()) as T
  } catch (error: unknown) {
    if (isAbortError(error)) throw error
    throw new ApiRequestError('INTERNAL', FALLBACK_MESSAGE, response.status)
  }
}

/* ---------- Каталог ---------- */

export function getServices(options?: RequestOptions): Promise<ServiceDto[]> {
  return request<ServiceDto[]>('/services', options)
}

export function getBarbers(options?: RequestOptions): Promise<BarberDto[]> {
  return request<BarberDto[]>('/barbers', options)
}

export function getPublicReviews(options?: RequestOptions): Promise<PublicReviewDto[]> {
  return request<PublicReviewDto[]>('/reviews/public', options)
}

/* ---------- Доступность ---------- */

export type AvailabilityParams = {
  serviceIds: readonly string[]
  /** uuid барбера или 'any'. */
  barberId: string
  date: string
}

export type AvailabilityDaysParams = Omit<AvailabilityParams, 'date'> & {
  from: string
  days: number
}

export function getAvailability(params: AvailabilityParams, options?: RequestOptions): Promise<AvailabilityResponse> {
  const query = new URLSearchParams({ serviceIds: params.serviceIds.join(','), barberId: params.barberId, date: params.date })
  return request<AvailabilityResponse>(`/availability?${query.toString()}`, options)
}

export function getAvailabilityDays(
  params: AvailabilityDaysParams,
  options?: RequestOptions,
): Promise<AvailabilityDaysResponse> {
  const query = new URLSearchParams({
    serviceIds: params.serviceIds.join(','),
    barberId: params.barberId,
    from: params.from,
    days: String(params.days),
  })
  return request<AvailabilityDaysResponse>(`/availability/days?${query.toString()}`, options)
}

/* ---------- Записи ---------- */

function tokenPath(token: string): string {
  return `/bookings/${encodeURIComponent(token)}`
}

export function createBooking(input: CreateBookingInput, options?: RequestOptions): Promise<BookingDto> {
  return request<BookingDto>('/bookings', { ...options, method: 'POST', body: input })
}

export function getBooking(token: string, options?: RequestOptions): Promise<BookingDto> {
  return request<BookingDto>(tokenPath(token), options)
}

export function cancelBooking(token: string, options?: RequestOptions): Promise<BookingDto> {
  return request<BookingDto>(`${tokenPath(token)}/cancel`, { ...options, method: 'POST', body: {} })
}

export function rescheduleBooking(token: string, startsAt: string, options?: RequestOptions): Promise<BookingDto> {
  return request<BookingDto>(`${tokenPath(token)}/reschedule`, { ...options, method: 'POST', body: { startsAt } })
}
