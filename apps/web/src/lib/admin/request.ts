import { ADMIN_API_PREFIX, ADMIN_CSRF_HEADER, ADMIN_CSRF_VALUE, API_PREFIX } from '@barber/shared'

import { apiBaseUrl, isAbortError, parseErrorResponse, send, ApiRequestError } from '../api'

/*
 * Низкоуровневый HTTP-слой админского API. Всегда отправляет cookie сессии (credentials: 'include')
 * и заголовок CSRF на изменяющие запросы — иначе сервер ответит 403.
 */

export type AdminMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const MUTATING_METHODS: ReadonlySet<AdminMethod> = new Set<AdminMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])

export type AdminRequestOptions = {
  method?: AdminMethod
  body?: unknown
  /** Готовая строка запроса вида '?page=2' (см. toQueryString). */
  query?: string
}

export type QueryValue = string | number | boolean | null | undefined

/** Собирает строку запроса: пустые значения (undefined, null, '') пропускаются. */
export function toQueryString(params: Readonly<Record<string, QueryValue>>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

function buildHeaders(method: AdminMethod, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (hasBody) headers['content-type'] = 'application/json'
  if (MUTATING_METHODS.has(method)) headers[ADMIN_CSRF_HEADER] = ADMIN_CSRF_VALUE
  return headers
}

/** Выполняет запрос к /api/v1/admin{path}; неуспешный ответ превращается в ApiRequestError. */
export async function adminFetch(path: string, options: AdminRequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, query = '' } = options
  const url = `${apiBaseUrl()}${API_PREFIX}${ADMIN_API_PREFIX}${path}${query}`
  const response = await send(url, {
    method,
    credentials: 'include',
    headers: buildHeaders(method, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw await parseErrorResponse(response)
  return response
}

/** Запрос с JSON-ответом. Тело ответа доверяем контракту shared-типов. */
export async function adminJson<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
  const response = await adminFetch(path, options)
  try {
    return (await response.json()) as T
  } catch (error: unknown) {
    if (isAbortError(error)) throw error
    throw new ApiRequestError('INTERNAL', 'Сервер вернул неожиданный ответ', response.status)
  }
}

/** Запрос без тела ответа (204 и т.п.). */
export async function adminVoid(path: string, options: AdminRequestOptions = {}): Promise<void> {
  await adminFetch(path, options)
}
