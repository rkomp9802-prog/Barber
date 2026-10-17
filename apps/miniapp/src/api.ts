import {
  API_ERROR_CODES,
  API_PREFIX,
  type ApiErrorCode,
  type AvailabilityDaysResponse,
  type AvailabilityResponse,
  type BarberDto,
  type BookingDto,
  type CreateBookingInput,
  type MeDto,
  type ServiceDto,
  TELEGRAM_INIT_DATA_HEADER,
} from '@barber/shared'

/** Коды ошибок, которые возникают на клиенте, а не приходят от API. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'UNKNOWN'
export type RequestErrorCode = ApiErrorCode | ClientErrorCode

export class ApiRequestError extends Error {
  readonly code: RequestErrorCode
  readonly status: number
  readonly details: unknown

  constructor(code: RequestErrorCode, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export const DEFAULT_API_URL = 'http://localhost:4000'

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Код по HTTP-статусу, если тело ответа не похоже на ApiError. */
function codeFromStatus(status: number): RequestErrorCode {
  if (status === 401 || status === 403) return 'UNAUTHORIZED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'SLOT_TAKEN'
  if (status === 400 || status === 422) return 'VALIDATION_ERROR'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'INTERNAL'
  return 'UNKNOWN'
}

/** Превращает тело ответа с ошибкой (любой формы) в типизированную ApiRequestError. */
export function parseApiError(status: number, body: unknown): ApiRequestError {
  if (isRecord(body) && isApiErrorCode(body.code)) {
    const message = typeof body.message === 'string' ? body.message : body.code
    return new ApiRequestError(body.code, message, status, body.details)
  }
  return new ApiRequestError(codeFromStatus(status), `HTTP ${status}`, status)
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function normalizeBaseUrl(raw: string | undefined): string {
  const base = raw && raw.trim() !== '' ? raw.trim() : DEFAULT_API_URL
  return `${base.replace(/\/+$/, '')}${API_PREFIX}`
}

export type ApiClientOptions = {
  baseUrl: string
  getInitData: () => string
  fetchImpl?: typeof fetch
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function buildHeaders(initData: string, hasBody: boolean): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(initData !== '' ? { [TELEGRAM_INIT_DATA_HEADER]: initData } : {}),
  }
}

export type AvailabilityParams = { serviceIds: readonly string[]; barberId: string; date: string }
export type AvailabilityDaysParams = { serviceIds: readonly string[]; barberId: string; from: string; days: number }

export type ApiClient = {
  getServices: (signal?: AbortSignal) => Promise<ServiceDto[]>
  getBarbers: (signal?: AbortSignal) => Promise<BarberDto[]>
  getAvailability: (params: AvailabilityParams, signal?: AbortSignal) => Promise<AvailabilityResponse>
  getAvailabilityDays: (params: AvailabilityDaysParams, signal?: AbortSignal) => Promise<AvailabilityDaysResponse>
  createBooking: (input: CreateBookingInput, signal?: AbortSignal) => Promise<BookingDto>
  getMyBookings: (signal?: AbortSignal) => Promise<BookingDto[]>
  /** Профиль: подтверждён ли номер через Telegram. */
  getMe: (signal?: AbortSignal) => Promise<MeDto>
  cancelBooking: (manageToken: string, signal?: AbortSignal) => Promise<BookingDto>
  rescheduleBooking: (manageToken: string, startsAt: string, signal?: AbortSignal) => Promise<BookingDto>
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))

  async function request<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
    let response: Response
    try {
      response = await fetchImpl(`${options.baseUrl}${path}`, {
        method,
        headers: buildHeaders(options.getInitData(), body !== undefined),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      })
    } catch (error: unknown) {
      if (isAbortError(error)) throw error
      throw new ApiRequestError('NETWORK_ERROR', 'Network request failed', 0, error)
    }
    const data = await readJson(response)
    if (!response.ok) throw parseApiError(response.status, data)
    return data as T
  }

  const ids = (serviceIds: readonly string[]): string => serviceIds.join(',')
  const token = (value: string): string => encodeURIComponent(value)

  return {
    getServices: signal => request('/services', { signal }),
    getBarbers: signal => request('/barbers', { signal }),
    getAvailability: ({ serviceIds, barberId, date }, signal) =>
      request(`/availability?${new URLSearchParams({ serviceIds: ids(serviceIds), barberId, date })}`, { signal }),
    getAvailabilityDays: ({ serviceIds, barberId, from, days }, signal) =>
      request(
        `/availability/days?${new URLSearchParams({ serviceIds: ids(serviceIds), barberId, from, days: String(days) })}`,
        { signal },
      ),
    createBooking: (input, signal) => request('/bookings', { method: 'POST', body: input, signal }),
    getMyBookings: signal => request('/me/bookings', { signal }),
    getMe: signal => request('/me', { signal }),
    cancelBooking: (manageToken, signal) =>
      request(`/bookings/${token(manageToken)}/cancel`, { method: 'POST', body: {}, signal }),
    rescheduleBooking: (manageToken, startsAt, signal) =>
      request(`/bookings/${token(manageToken)}/reschedule`, { method: 'POST', body: { startsAt }, signal }),
  }
}
