import type { BookingDto } from '@barber/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Notifier } from '../../src/notifications/notifier'
import { MONDAY, NOW, tashkent } from '../fixtures/calendar'
import { setBookingStatus } from '../fakes/memory-repositories'
import { IDS, createTestApp, type TestApp } from '../fakes/seed-state'

let t: TestApp | undefined

afterEach(async () => {
  await t?.app.close()
  t = undefined
})

const client = { name: 'Иван', phone: '+998901234567' }
const at = (hhmm: string, day = MONDAY): string => new Date(tashkent(day, hhmm)).toISOString()

function mockNotifier(): Notifier & { [K in keyof Notifier]: ReturnType<typeof vi.fn> } {
  return {
    bookingCreated: vi.fn(async () => undefined),
    bookingCancelled: vi.fn(async () => undefined),
    bookingRescheduled: vi.fn(async () => undefined),
  }
}

async function setup(options: Parameters<typeof createTestApp>[0] = { now: NOW }): Promise<TestApp> {
  t = await createTestApp(options)
  return t
}

function create(app: TestApp, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return app.app.inject({ method: 'POST', url: '/api/v1/bookings', payload: body, headers })
}

describe('POST /bookings', () => {
  it('создаёт запись: цена и длительность считаются на сервере', async () => {
    const notifier = mockNotifier()
    const app = await setup({ now: NOW, notifier })
    const res = await create(app, { serviceIds: [IDS.haircut, IDS.beard], barberId: IDS.timur, startsAt: at('10:00'), client })
    expect(res.statusCode).toBe(201)
    const body = res.json<BookingDto>()
    expect(body).toMatchObject({
      status: 'confirmed',
      source: 'web',
      startsAt: '2026-10-12T05:00:00.000Z',
      endsAt: '2026-10-12T06:30:00.000Z',
      totalPrice: 220_000, // стрижка у Тимура 150 000 (переопределение) + борода 70 000
      totalDurationMin: 90,
      barber: { id: IDS.timur, name: 'Тимур' },
      client,
      canChange: true,
    })
    expect(body.manageToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(body.telegramLink).toBe(`https://t.me/sharp_test_bot?start=b_${body.manageToken}`)
    expect(body.services.map(s => s.price)).toEqual([150_000, 70_000])
    expect(notifier.bookingCreated).toHaveBeenCalledOnce()
  })

  it('лишние поля от фронтенда (цена) игнорируются', async () => {
    const app = await setup()
    const res = await create(app, { serviceIds: [IDS.haircut], barberId: IDS.aziz, startsAt: at('10:00'), client, totalPrice: 1 })
    expect(res.json<BookingDto>().totalPrice).toBe(120_000)
  })

  it('имя с переносом строки отклоняется (нельзя подделать текст уведомления барберу)', async () => {
    const app = await setup()
    const res = await create(app, {
      serviceIds: [IDS.haircut],
      barberId: IDS.aziz,
      startsAt: at('10:00'),
      client: { name: 'Иван\nКлиент: Админ', phone: client.phone },
    })
    expect(res.statusCode).toBe(422)
  })

  it('чужой телефон не даёт доступа к клиенту владельца номера', async () => {
    const app = await setup()
    const victim = await create(app, { serviceIds: [IDS.haircut], barberId: IDS.aziz, startsAt: at('10:00'), client })
    const attacker = await create(app, {
      serviceIds: [IDS.haircut],
      barberId: IDS.aziz,
      startsAt: at('12:00'),
      client: { name: 'Чужой', phone: client.phone },
    })
    expect(attacker.statusCode).toBe(201)
    // Имя владельца номера не раскрывается, запись — у отдельного клиента.
    expect(attacker.json<BookingDto>().client.name).toBe('Чужой')
    const clientOf = (token: string) => app.state.bookings.find(b => b.manageToken === token)?.clientId
    expect(clientOf(attacker.json<BookingDto>().manageToken)).not.toBe(clientOf(victim.json<BookingDto>().manageToken))
  })
  it('не больше 3 предстоящих записей на номер; после отмены можно снова', async () => {
    const app = await setup()
    const book = (barberId: string, time: string) => create(app, { serviceIds: [IDS.haircut], barberId, startsAt: at(time), client })
    const first = await book(IDS.aziz, '10:00')
    expect((await book(IDS.aziz, '11:00')).statusCode).toBe(201)
    expect((await book(IDS.aziz, '12:00')).statusCode).toBe(201)
    const fourth = await book(IDS.timur, '10:00')
    expect(fourth.statusCode).toBe(409)
    expect(fourth.json<{ code: string }>().code).toBe('TOO_MANY_BOOKINGS')
    const token = first.json<BookingDto>().manageToken
    expect((await app.app.inject({ method: 'POST', url: `/api/v1/bookings/${token}/cancel` })).statusCode).toBe(200)
    expect((await book(IDS.timur, '10:00')).statusCode).toBe(201)
  })

  it('занятое время → 409 SLOT_TAKEN', async () => {
    const app = await setup()
    const body = { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('11:00'), client }
    expect((await create(app, body)).statusCode).toBe(201)
    const second = await create(app, { ...body, startsAt: at('11:30') })
    expect(second.statusCode).toBe(409)
    expect(second.json()).toMatchObject({ code: 'SLOT_TAKEN' })
  })

  it('гонка: два параллельных запроса на один слот → один 201 и один 409', async () => {
    const app = await setup()
    const body = { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('12:00'), client }
    const codes = (await Promise.all([create(app, body), create(app, body)])).map(r => r.statusCode).sort()
    expect(codes).toEqual([201, 409])
  })

  it.each([
    ['TOO_SOON', () => new Date(NOW + 10 * 60_000).toISOString(), 422],
    ['TOO_FAR', () => at('12:00', '2026-12-01'), 422],
    ['OUTSIDE_WORKING_HOURS', () => at('14:00'), 422],
    ['OUTSIDE_WORKING_HOURS', () => at('20:30'), 422],
  ])('%s', async (code, startsAt, status) => {
    const app = await setup()
    const res = await create(app, { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: startsAt(), client })
    expect(res.statusCode).toBe(status)
    expect(res.json()).toMatchObject({ code })
  })

  it('time_off барбера → OUTSIDE_WORKING_HOURS', async () => {
    const app = await setup()
    app.state.timeOff = [{ barberId: IDS.timur, startsAt: new Date(tashkent(MONDAY, '00:00')), endsAt: new Date(tashkent('2026-10-13', '00:00')) }]
    const res = await create(app, { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('10:00'), client })
    expect(res.json()).toMatchObject({ code: 'OUTSIDE_WORKING_HOURS' })
  })

  it('barberId=any выбирает наименее загруженного; когда все заняты — 409', async () => {
    const app = await setup()
    const first = await create(app, { serviceIds: [IDS.haircut], barberId: 'any', startsAt: at('10:00'), client })
    expect(first.json<BookingDto>().barber.id).toBe(IDS.timur) // равная загрузка → sort_order
    const second = await create(app, { serviceIds: [IDS.haircut], barberId: 'any', startsAt: at('16:00'), client })
    expect(second.json<BookingDto>().barber.id).toBe(IDS.aziz) // у Тимура уже есть запись в этот день
    const third = await create(app, { serviceIds: [IDS.haircut], barberId: 'any', startsAt: at('16:00'), client })
    expect(third.json<BookingDto>().barber.id).toBe(IDS.timur)
    const fourth = await create(app, { serviceIds: [IDS.haircut], barberId: 'any', startsAt: at('16:00'), client })
    expect(fourth.statusCode).toBe(409)
  })

  it('неизвестная услуга, чужая услуга, неизвестный барбер', async () => {
    const app = await setup()
    const missing = '99999999-9999-4999-8999-999999999999'
    expect((await create(app, { serviceIds: [missing], barberId: 'any', startsAt: at('10:00'), client })).json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
    expect((await create(app, { serviceIds: [IDS.shave], barberId: IDS.timur, startsAt: at('10:00'), client })).json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
    const unknownBarber = await create(app, { serviceIds: [IDS.haircut], barberId: missing, startsAt: at('10:00'), client })
    expect(unknownBarber.statusCode).toBe(404)
  })

  it('валидация входа общими Zod-схемами', async () => {
    const app = await setup()
    const res = await create(app, { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('10:00'), client: { name: 'И', phone: '123' } })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ details: { path: string }[] }>().details.map(d => d.path)).toEqual(['client.name', 'client.phone'])
  })

  it('ошибка уведомления не ломает создание записи', async () => {
    const notifier = mockNotifier()
    notifier.bookingCreated.mockRejectedValueOnce(new Error('telegram down'))
    const app = await setup({ now: NOW, notifier })
    const res = await create(app, { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('10:00'), client })
    expect(res.statusCode).toBe(201)
  })

  it('без настроенного бота telegramLink = null', async () => {
    const app = await setup({ now: NOW, config: { telegram: { botToken: undefined, botUsername: undefined, initDataMaxAgeSec: 86_400 } } })
    const res = await create(app, { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('10:00'), client })
    expect(res.json<BookingDto>().telegramLink).toBeNull()
  })
})

describe('GET /bookings/:token', () => {
  it('возвращает запись по токену и 404 для неизвестного', async () => {
    const app = await setup()
    const created = (await create(app, { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('10:00'), client })).json<BookingDto>()
    const res = await app.app.inject({ method: 'GET', url: `/api/v1/bookings/${created.manageToken}` })
    expect(res.json<BookingDto>().id).toBe(created.id)
    for (const token of ['short', 'x'.repeat(43)]) {
      const missing = await app.app.inject({ method: 'GET', url: `/api/v1/bookings/${token}` })
      expect(missing.statusCode).toBe(404)
    }
  })

  it('отменённая запись: canChange = false', async () => {
    const app = await setup()
    const created = (await create(app, { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('10:00'), client })).json<BookingDto>()
    setBookingStatus(app.state, created.id, 'cancelled')
    const res = await app.app.inject({ method: 'GET', url: `/api/v1/bookings/${created.manageToken}` })
    expect(res.json<BookingDto>()).toMatchObject({ status: 'cancelled', canChange: false })
  })
})
