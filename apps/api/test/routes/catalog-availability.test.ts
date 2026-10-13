import type { AvailabilityDaysResponse, AvailabilityResponse, BarberDto, ServiceDto } from '@barber/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MONDAY, NOW, interval } from '../fixtures/calendar'
import { IDS, createTestApp, type TestApp } from '../fakes/seed-state'

let t: TestApp

beforeEach(async () => {
  t = await createTestApp({ now: NOW })
})
afterEach(async () => {
  await t.app.close()
})

function availability(query: string) {
  return t.app.inject({ method: 'GET', url: `/api/v1/availability?${query}` })
}

describe('служебные маршруты', () => {
  it('GET /health в корне и под /api/v1', async () => {
    for (const url of ['/health', '/api/v1/health']) {
      const res = await t.app.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ status: 'ok' })
    }
  })

  it('неизвестный маршрут → 404 NOT_FOUND в формате ApiError', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/unknown' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Маршрут не найден' })
  })

  it('CORS: разрешённый origin получает заголовок, чужой — нет', async () => {
    const ok = await t.app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:3000' } })
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    const evil = await t.app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example' } })
    expect(evil.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('CORS preflight: initData-заголовок, методы и credentials для Mini App', async () => {
    const res = await t.app.inject({
      method: 'OPTIONS',
      url: '/api/v1/bookings',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-telegram-init-data',
      },
    })
    expect(res.statusCode).toBe(204)
    expect(res.headers['access-control-allow-headers']).toContain('x-telegram-init-data')
    expect(res.headers['access-control-allow-headers']).toContain('content-type')
    expect(res.headers['access-control-allow-methods']).toBe('GET, POST, PUT, PATCH, DELETE, OPTIONS')
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('битый JSON → 400 VALIDATION_ERROR', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers: { 'content-type': 'application/json' },
      payload: '{bad',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

describe('каталог', () => {
  it('GET /services — активные услуги', async () => {
    t.state.services = t.state.services.map(s => (s.id === IDS.shave ? { ...s, isActive: false } : s))
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/services' })
    const body = res.json<ServiceDto[]>()
    expect(body.map(s => s.id)).toEqual([IDS.haircut, IDS.beard])
    expect(body[0]).toEqual({ id: IDS.haircut, name: 'Мужская стрижка', description: '', durationMin: 60, price: 120_000 })
  })

  it('GET /barbers и /barbers/:id', async () => {
    const list = (await t.app.inject({ method: 'GET', url: '/api/v1/barbers' })).json<BarberDto[]>()
    expect(list.map(b => b.name)).toEqual(['Тимур', 'Азиз', 'Рустам'])
    expect(list[0]?.serviceIds).toEqual([IDS.haircut, IDS.beard])
    const one = await t.app.inject({ method: 'GET', url: `/api/v1/barbers/${IDS.aziz}` })
    expect(one.json<BarberDto>()).toMatchObject({ id: IDS.aziz, name: 'Азиз', rating: 0, reviewsCount: 0 })
  })

  it('GET /barbers/:id — 404 для неизвестного и некорректного id', async () => {
    for (const id of ['not-a-uuid', '99999999-9999-4999-8999-999999999999']) {
      const res = await t.app.inject({ method: 'GET', url: `/api/v1/barbers/${id}` })
      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' })
    }
  })
})

describe('GET /availability', () => {
  it('слоты конкретного барбера с учётом обеда', async () => {
    const res = await availability(`serviceIds=${IDS.haircut}&barberId=${IDS.timur}&date=${MONDAY}`)
    expect(res.statusCode).toBe(200)
    const body = res.json<AvailabilityResponse>()
    expect(body.durationMin).toBe(60)
    expect(body.slots[0]).toEqual({ startsAt: '2026-10-12T05:00:00.000Z', time: '10:00', barberIds: [IDS.timur] })
    expect(body.slots.map(s => s.time)).not.toContain('14:00')
  })

  it('переопределение длительности у барбера (борода у Азиза — 45 мин)', async () => {
    const res = await availability(`serviceIds=${IDS.beard}&barberId=${IDS.aziz}&date=${MONDAY}`)
    const body = res.json<AvailabilityResponse>()
    expect(body.durationMin).toBe(45)
    expect(body.slots.at(-1)?.time).toBe('20:15')
  })

  it('barberId=any — объединение подходящих барберов', async () => {
    t.state.bookings = []
    const res = await availability(`serviceIds=${IDS.haircut}&barberId=any&date=${MONDAY}`)
    const body = res.json<AvailabilityResponse>()
    expect(body.slots[0]?.barberIds).toEqual([IDS.timur, IDS.aziz])
  })

  it('учитывает time_off всего салона', async () => {
    t.state.timeOff = [{ barberId: null, ...toDates(interval(MONDAY, '00:00', '23:59')) }]
    const body = (await availability(`serviceIds=${IDS.haircut}&barberId=any&date=${MONDAY}`)).json<AvailabilityResponse>()
    expect(body.slots).toEqual([])
  })

  it('барбер не делает услугу → 422 SERVICE_UNAVAILABLE', async () => {
    const res = await availability(`serviceIds=${IDS.shave}&barberId=${IDS.timur}&date=${MONDAY}`)
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
  })

  it('прошедшая дата и несуществующая дата', async () => {
    const past = (await availability(`serviceIds=${IDS.haircut}&barberId=any&date=2026-10-01`)).json<AvailabilityResponse>()
    expect(past.slots).toEqual([])
    const invalid = await availability(`serviceIds=${IDS.haircut}&barberId=any&date=2026-02-30`)
    expect(invalid.statusCode).toBe(422)
  })

  it('неверные параметры → 422 VALIDATION_ERROR', async () => {
    const res = await availability('serviceIds=&barberId=any&date=tomorrow')
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

describe('GET /availability/days', () => {
  it('отмечает дни со слотами и выходные', async () => {
    t.state.hours = t.state.hours.filter(h => !(h.barberId === IDS.timur && h.weekday === 2))
    const res = await t.app.inject({
      method: 'GET',
      url: `/api/v1/availability/days?serviceIds=${IDS.haircut}&barberId=${IDS.timur}&from=2026-10-11&days=4`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<AvailabilityDaysResponse>().days).toEqual([
      { date: '2026-10-11', hasSlots: true },
      { date: '2026-10-12', hasSlots: true },
      { date: '2026-10-13', hasSlots: false },
      { date: '2026-10-14', hasSlots: true },
    ])
  })

  it('дни за горизонтом записи пустые; days по умолчанию 14', async () => {
    t.state.settings = { booking_horizon_days: 2 }
    const res = await t.app.inject({
      method: 'GET',
      url: `/api/v1/availability/days?serviceIds=${IDS.haircut}&barberId=any&from=2026-10-11`,
    })
    const days = res.json<AvailabilityDaysResponse>().days
    expect(days).toHaveLength(14)
    expect(days.filter(d => d.hasSlots).map(d => d.date)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13'])
  })
})

function toDates(range: { start: number; end: number }): { startsAt: Date; endsAt: Date } {
  return { startsAt: new Date(range.start), endsAt: new Date(range.end) }
}
