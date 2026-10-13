import type { AdminBookingDto, AdminTimeOffResultDto, Paginated } from '@barber/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { MONDAY, tashkent } from '../fixtures/calendar'
import { IDS } from '../fakes/seed-state'
import { adminInject, createAdminTestApp, loginCookie, spyNotifier, type AdminTestApp } from './harness'
import type { AdminMemoryState } from './fakes'

const NOW = tashkent(MONDAY, '09:00')
const client = { name: 'Иван Петров', phone: '+998901234567' }

let t: AdminTestApp | undefined
afterEach(async () => {
  await t?.app.close()
  t = undefined
})

type Session = { readonly app: AdminTestApp; readonly cookie: string; readonly notifier: ReturnType<typeof spyNotifier> }

async function start(now = NOW, state?: AdminMemoryState): Promise<Session> {
  const notifier = spyNotifier()
  t = await createAdminTestApp({ now, state, notifier })
  return { app: t, cookie: await loginCookie(t.app), notifier }
}

/** Пересоздаёт приложение над тем же состоянием с другим «сейчас». */
async function at(session: Session, now: number): Promise<Session> {
  await session.app.app.close()
  const notifier = session.notifier
  t = await createAdminTestApp({ now, state: session.app.state, notifier })
  return { app: t, cookie: await loginCookie(t.app), notifier }
}

function manual(session: Session, overrides: Record<string, unknown> = {}) {
  return adminInject(session.app.app, 'POST', '/bookings', {
    cookie: session.cookie,
    payload: {
      serviceIds: [IDS.haircut],
      barberId: IDS.timur,
      startsAt: new Date(tashkent(MONDAY, '12:00')).toISOString(),
      client,
      ...overrides,
    },
  })
}

describe('ручная запись POST /admin/bookings', () => {
  it('создаёт запись с источником admin и ценой барбера (201)', async () => {
    const session = await start()
    const res = await manual(session)
    expect(res.statusCode).toBe(201)
    expect(res.json<AdminBookingDto>()).toMatchObject({
      status: 'confirmed',
      source: 'admin',
      totalPrice: 150_000,
      totalDurationMin: 60,
      barber: { id: IDS.timur },
      client: { name: client.name, phone: client.phone },
    })
  })

  it('пересечение с другой записью барбера → 409 SLOT_TAKEN', async () => {
    const session = await start()
    expect((await manual(session)).statusCode).toBe(201)
    const clash = await manual(session, { startsAt: new Date(tashkent(MONDAY, '12:30')).toISOString() })
    expect(clash.statusCode).toBe(409)
    expect(clash.json()).toMatchObject({ code: 'SLOT_TAKEN' })
  })

  it('обеденный перерыв без force → 422 OUTSIDE_WORKING_HOURS, с force → 201', async () => {
    const session = await start()
    const lunch = new Date(tashkent(MONDAY, '14:00')).toISOString()
    const refused = await manual(session, { startsAt: lunch })
    expect(refused.statusCode).toBe(422)
    expect(refused.json()).toMatchObject({ code: 'OUTSIDE_WORKING_HOURS' })
    const forced = await manual(session, { startsAt: lunch, force: true })
    expect(forced.statusCode).toBe(201)
  })

  it('force не отменяет пересечение: занятое время всегда 409', async () => {
    const session = await start()
    expect((await manual(session)).statusCode).toBe(201)
    const res = await manual(session, { force: true })
    expect(res.statusCode).toBe(409)
  })

  it('не действует min_notice_min: запись «через полчаса» проходит', async () => {
    const session = await start()
    session.app.state.settings = { min_notice_min: 7 * 24 * 60 }
    const soon = new Date(NOW + 60 * 60 * 1000).toISOString()
    const res = await manual(session, { startsAt: soon })
    expect(res.statusCode).toBe(201)
  })

  it('запись в прошлый день → 422 VALIDATION_ERROR', async () => {
    const session = await start()
    const res = await manual(session, { startsAt: new Date(tashkent('2026-10-11', '12:00')).toISOString() })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('дальше 365 дней → 422', async () => {
    const session = await start()
    const res = await manual(session, { startsAt: new Date(tashkent('2027-10-13', '12:00')).toISOString() })
    expect(res.statusCode).toBe(422)
  })

  it('барбер не делает услугу → 422 SERVICE_UNAVAILABLE', async () => {
    const session = await start()
    const res = await manual(session, { barberId: IDS.rustam })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
  })

  it('телефон не в формате +998 → 422', async () => {
    const session = await start()
    const res = await manual(session, { client: { name: client.name, phone: '8901234567' } })
    expect(res.statusCode).toBe(422)
  })
})

describe('смена статуса PATCH /admin/bookings/:id', () => {
  it('confirmed → completed после начала записи', async () => {
    const session = await start()
    const created = (await manual(session)).json<AdminBookingDto>()
    const later = await at(session, tashkent(MONDAY, '12:30'))
    const res = await adminInject(later.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: later.cookie,
      payload: { status: 'completed' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<AdminBookingDto>().status).toBe('completed')
  })

  it('completed / no_show до начала записи → 422', async () => {
    const session = await start()
    const created = (await manual(session)).json<AdminBookingDto>()
    const res = await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { status: 'no_show' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('отмена уведомляет клиента и барбера, повторный переход → 409 BOOKING_NOT_ACTIVE', async () => {
    const session = await start()
    const created = (await manual(session)).json<AdminBookingDto>()
    const first = await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { status: 'cancelled' },
    })
    expect(first.json<AdminBookingDto>().status).toBe('cancelled')
    expect(session.notifier.bookingCancelled).toHaveBeenCalledOnce()
    const again = await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { status: 'completed' },
    })
    expect(again.statusCode).toBe(409)
    expect(again.json()).toMatchObject({ code: 'BOOKING_NOT_ACTIVE' })
  })

  it('статус вне списка админских целей (confirmed) → 422', async () => {
    const session = await start()
    const created = (await manual(session)).json<AdminBookingDto>()
    const res = await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { status: 'confirmed' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('отмена не зависит от cancel_cutoff_min: за минуту до визита — можно', async () => {
    const session = await start()
    const created = (await manual(session)).json<AdminBookingDto>()
    const soon = await at(session, tashkent(MONDAY, '11:59'))
    const res = await adminInject(soon.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: soon.cookie,
      payload: { status: 'cancelled' },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('перенос PATCH /admin/bookings/:id { startsAt }', () => {
  it('переносит, сбрасывает флаги напоминаний и уведомляет', async () => {
    const session = await start()
    const created = (await manual(session)).json<AdminBookingDto>()
    const stored = session.app.state.bookings.find(item => item.id === created.id)
    if (!stored) throw new Error('запись не сохранилась')
    stored.reminderDaySentAt = new Date(NOW)
    stored.reminder30mSentAt = new Date(NOW)
    const newStart = new Date(tashkent(MONDAY, '16:00')).toISOString()
    const res = await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { startsAt: newStart, force: false },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<AdminBookingDto>().startsAt).toBe(newStart)
    const after = session.app.state.bookings.find(item => item.id === created.id)
    expect(after?.reminderDaySentAt).toBeNull()
    expect(after?.reminder30mSentAt).toBeNull()
    expect(session.notifier.bookingRescheduled).toHaveBeenCalledOnce()
  })

  it('перенос на занятое время → 409 SLOT_TAKEN', async () => {
    const session = await start()
    const created = (await manual(session)).json<AdminBookingDto>()
    expect((await manual(session, { startsAt: new Date(tashkent(MONDAY, '17:00')).toISOString() })).statusCode).toBe(201)
    const res = await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { startsAt: new Date(tashkent(MONDAY, '17:30')).toISOString(), force: false },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ code: 'SLOT_TAKEN' })
  })

  it('перенос в обед без force → 422, с force → 200', async () => {
    const session = await start()
    const created = (await manual(session)).json<AdminBookingDto>()
    const lunch = new Date(tashkent(MONDAY, '14:00')).toISOString()
    const refused = await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { startsAt: lunch, force: false },
    })
    expect(refused.statusCode).toBe(422)
    const forced = await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { startsAt: lunch, force: true },
    })
    expect(forced.statusCode).toBe(200)
  })

  it('завершённую запись перенести нельзя → 409 BOOKING_NOT_ACTIVE', async () => {
    const session = await start()
    const created = (await manual(session)).json<AdminBookingDto>()
    await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { status: 'cancelled' },
    })
    const res = await adminInject(session.app.app, 'PATCH', `/bookings/${created.id}`, {
      cookie: session.cookie,
      payload: { startsAt: new Date(tashkent(MONDAY, '18:00')).toISOString(), force: false },
    })
    expect(res.statusCode).toBe(409)
  })
})

describe('исключения (time-off)', () => {
  const timeOff = (session: Session, payload: unknown) =>
    adminInject(session.app.app, 'POST', '/time-off', { cookie: session.cookie, payload })

  it('исключение барбера возвращает пересекающиеся записи в conflicts, сами записи не отменяются', async () => {
    const session = await start()
    const booked = (await manual(session)).json<AdminBookingDto>()
    const res = await timeOff(session, {
      barberId: IDS.timur,
      startsAt: new Date(tashkent(MONDAY, '11:00')).toISOString(),
      endsAt: new Date(tashkent(MONDAY, '13:00')).toISOString(),
      type: 'sick',
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<AdminTimeOffResultDto>()
    expect(body.conflicts.map(item => item.id)).toEqual([booked.id])
    expect(session.app.state.bookings.find(item => item.id === booked.id)?.status).toBe('confirmed')
    expect(session.app.state.timeOff).toHaveLength(1)
  })

  it('закрытие салона (barberId null) захватывает записи всех барберов', async () => {
    const session = await start()
    await manual(session)
    await manual(session, { barberId: IDS.aziz, serviceIds: [IDS.beard], startsAt: new Date(tashkent(MONDAY, '18:00')).toISOString() })
    const res = await timeOff(session, {
      barberId: null,
      startsAt: new Date(tashkent(MONDAY, '00:00')).toISOString(),
      endsAt: new Date(tashkent('2026-10-13', '00:00')).toISOString(),
      type: 'shop_closed',
    })
    expect(res.json<AdminTimeOffResultDto>().conflicts).toHaveLength(2)
  })

  it('shop_closed с барбером → 422; начало не раньше конца → 422; неизвестный барбер → 422', async () => {
    const session = await start()
    const window = {
      startsAt: new Date(tashkent(MONDAY, '11:00')).toISOString(),
      endsAt: new Date(tashkent(MONDAY, '12:00')).toISOString(),
    }
    expect((await timeOff(session, { ...window, barberId: IDS.timur, type: 'shop_closed' })).statusCode).toBe(422)
    expect((await timeOff(session, { ...window, startsAt: window.endsAt, endsAt: window.startsAt, barberId: IDS.timur })).statusCode).toBe(422)
    expect((await timeOff(session, { ...window, barberId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })).statusCode).toBe(422)
  })

  it('список фильтруется по дням и по салону; PATCH меняет примечание; DELETE → 204', async () => {
    const session = await start()
    const created = await timeOff(session, {
      barberId: null,
      startsAt: new Date(tashkent('2026-10-13', '00:00')).toISOString(),
      endsAt: new Date(tashkent('2026-10-14', '00:00')).toISOString(),
      type: 'shop_closed',
      note: 'Праздник',
    })
    const id = created.json<AdminTimeOffResultDto>().timeOff.id
    const onMonday = await adminInject(session.app.app, 'GET', '/time-off?from=2026-10-12&to=2026-10-12', { cookie: session.cookie })
    expect(onMonday.json<unknown[]>()).toEqual([])
    const shop = await adminInject(session.app.app, 'GET', '/time-off?from=2026-10-13&to=2026-10-13&barberId=shop', { cookie: session.cookie })
    expect(shop.json<{ id: string }[]>().map(item => item.id)).toEqual([id])

    const patched = await adminInject(session.app.app, 'PATCH', `/time-off/${id}`, { cookie: session.cookie, payload: { note: 'Перенесено' } })
    expect(patched.json<AdminTimeOffResultDto>().timeOff.note).toBe('Перенесено')

    const removed = await adminInject(session.app.app, 'DELETE', `/time-off/${id}`, { cookie: session.cookie })
    expect(removed.statusCode).toBe(204)
    expect(session.app.state.timeOff).toHaveLength(0)
  })
})

describe('список записей и «сегодня»', () => {
  it('фильтры, пагинация и поиск по имени', async () => {
    const session = await start()
    await manual(session)
    await manual(session, { barberId: IDS.aziz, serviceIds: [IDS.beard], startsAt: new Date(tashkent(MONDAY, '18:00')).toISOString(), client: { name: 'Олег Смирнов', phone: '+998907654321' } })
    const page = await adminInject(session.app.app, 'GET', `/bookings?from=2026-10-12&to=2026-10-12&pageSize=1&page=2`, { cookie: session.cookie })
    expect(page.json<Paginated<AdminBookingDto>>()).toMatchObject({ total: 2, page: 2, pageSize: 1 })
    const search = await adminInject(session.app.app, 'GET', '/bookings?search=смирн', { cookie: session.cookie })
    expect(search.json<Paginated<AdminBookingDto>>().items.map(item => item.client.name)).toEqual(['Олег Смирнов'])
    const byBarber = await adminInject(session.app.app, 'GET', `/bookings?barberId=${IDS.timur}`, { cookie: session.cookie })
    expect(byBarber.json<Paginated<AdminBookingDto>>().total).toBe(1)
  })

  it('сегодня отдаёт записи дня по Ташкенту, все статусы', async () => {
    const session = await start()
    await manual(session)
    const res = await adminInject(session.app.app, 'GET', '/bookings/today', { cookie: session.cookie })
    expect(res.statusCode).toBe(200)
    expect(res.json<AdminBookingDto[]>()).toHaveLength(1)
  })

  it('неизвестный статус в фильтре → 422', async () => {
    const session = await start()
    const res = await adminInject(session.app.app, 'GET', '/bookings?status=paid', { cookie: session.cookie })
    expect(res.statusCode).toBe(422)
  })
})
