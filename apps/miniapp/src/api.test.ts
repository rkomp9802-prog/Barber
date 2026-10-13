import { TELEGRAM_INIT_DATA_HEADER } from '@barber/shared'
import { describe, expect, it, vi } from 'vitest'

import { ApiRequestError, createApiClient, normalizeBaseUrl, parseApiError } from './api'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('parseApiError', () => {
  it('reads code and message from an ApiError body', () => {
    const error = parseApiError(409, { code: 'SLOT_TAKEN', message: 'Slot is taken', details: { id: 1 } })
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error.code).toBe('SLOT_TAKEN')
    expect(error.message).toBe('Slot is taken')
    expect(error.status).toBe(409)
    expect(error.details).toEqual({ id: 1 })
  })

  it('falls back to HTTP status when the code is unknown', () => {
    expect(parseApiError(422, { code: 'SOMETHING_NEW' }).code).toBe('VALIDATION_ERROR')
    expect(parseApiError(401, null).code).toBe('UNAUTHORIZED')
    expect(parseApiError(404, 'Not Found').code).toBe('NOT_FOUND')
    expect(parseApiError(429, []).code).toBe('RATE_LIMITED')
    expect(parseApiError(503, undefined).code).toBe('INTERNAL')
    expect(parseApiError(418, {}).code).toBe('UNKNOWN')
  })

  it('uses the code as message when message is missing', () => {
    expect(parseApiError(422, { code: 'CUTOFF_PASSED' }).message).toBe('CUTOFF_PASSED')
  })
})

describe('normalizeBaseUrl', () => {
  it('uses localhost by default and appends the API prefix', () => {
    expect(normalizeBaseUrl(undefined)).toBe('http://localhost:4000/api/v1')
    expect(normalizeBaseUrl('  ')).toBe('http://localhost:4000/api/v1')
  })

  it('strips trailing slashes', () => {
    expect(normalizeBaseUrl('https://api.example.uz//')).toBe('https://api.example.uz/api/v1')
  })
})

describe('createApiClient', () => {
  const baseUrl = 'https://api.test/api/v1'

  it('sends initData header and builds availability query', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { date: '2026-10-12', durationMin: 30, slots: [] }))
    const client = createApiClient({ baseUrl, getInitData: () => 'query_id=1&hash=abc', fetchImpl })

    await client.getAvailability({ serviceIds: ['a', 'b'], barberId: 'any', date: '2026-10-12' })

    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe(`${baseUrl}/availability?serviceIds=a%2Cb&barberId=any&date=2026-10-12`)
    expect((init?.headers as Record<string, string>)[TELEGRAM_INIT_DATA_HEADER]).toBe('query_id=1&hash=abc')
  })

  it('omits the initData header outside Telegram and posts JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(201, { id: 'b1' }))
    const client = createApiClient({ baseUrl, getInitData: () => '', fetchImpl })
    const input = {
      serviceIds: ['s1'],
      barberId: 'any',
      startsAt: '2026-10-12T05:00:00Z',
      client: { name: 'Азиз', phone: '+998901234567' },
    }

    await expect(client.createBooking(input)).resolves.toEqual({ id: 'b1' })

    const init = fetchImpl.mock.calls[0]?.[1]
    const headers = init?.headers as Record<string, string>
    expect(init?.method).toBe('POST')
    expect(headers[TELEGRAM_INIT_DATA_HEADER]).toBeUndefined()
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual(input)
  })

  it('throws a typed ApiRequestError for error responses', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(409, { code: 'SLOT_TAKEN', message: 'taken' }))
    const client = createApiClient({ baseUrl, getInitData: () => '', fetchImpl })

    await expect(client.rescheduleBooking('tok/en', '2026-10-12T05:00:00Z')).rejects.toMatchObject({
      name: 'ApiRequestError',
      code: 'SLOT_TAKEN',
      status: 409,
    })
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${baseUrl}/bookings/tok%2Fen/reschedule`)
  })

  it('handles non-JSON error bodies', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))
    const client = createApiClient({ baseUrl, getInitData: () => '', fetchImpl })

    await expect(client.getServices()).rejects.toMatchObject({ code: 'INTERNAL', status: 502 })
  })

  it('maps network failures to NETWORK_ERROR', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createApiClient({ baseUrl, getInitData: () => '', fetchImpl })

    await expect(client.getBarbers()).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 })
  })

  it('rethrows aborts unchanged', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(abort)
    const client = createApiClient({ baseUrl, getInitData: () => '', fetchImpl })
    const controller = new AbortController()

    await expect(client.getMyBookings(controller.signal)).rejects.toBe(abort)
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })
})
