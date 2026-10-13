import type { BookingDto } from '@barber/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

async function withBooking(startsAt = at('12:00')) {
  const notifier = {
    bookingCreated: vi.fn(async () => undefined),
    bookingCancelled: vi.fn(async () => undefined),
    bookingRescheduled: vi.fn(async () => undefined),
  }
  const app = await createTestApp({ now: NOW, notifier })
  t = app
  const created = await app.app.inject({
    method: 'POST',
    url: '/api/v1/bookings',
    payload: { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt, client },
  })
  expect(created.statusCode).toBe(201)
  return { app, booking: created.json<BookingDto>(), notifier }
}

/** Пересоздаёт приложение над тем же состоянием с другим «сейчас». */
async function withNow(app: TestApp, now: number): Promise<TestApp> {
  await app.app.close()
  t = await createTestApp({ now, state: app.state })
  return t
}

describe('POST /bookings/:token/cancel', () => {
  it('отменяет подтверждённую запись и освобождает слот', async () => {
    const { app, booking, notifier } = await withBooking()
    const res = await app.app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/cancel` })
    expect(res.statusCode).toBe(200)
    expect(res.json<BookingDto>()).toMatchObject({ status: 'cancelled', canChange: false })
    expect(notifier.bookingCancelled).toHaveBeenCalledOnce()
    const again = await app.app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      payload: { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('12:00'), client },
    })
    expect(again.statusCode).toBe(201)
  })

  it('повторная отмена → 409 BOOKING_NOT_ACTIVE', async () => {
    const { app, booking } = await withBooking()
    await app.app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/cancel` })
    const res = await app.app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/cancel` })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ code: 'BOOKING_NOT_ACTIVE' })
  })

  it('позже cancel_cutoff_min → 422 CUTOFF_PASSED', async () => {
    const { app, booking } = await withBooking()
    const later = await withNow(app, tashkent(MONDAY, '11:45'))
    const res = await later.app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/cancel` })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ code: 'CUTOFF_PASSED' })
  })
})

describe('POST /bookings/:token/reschedule', () => {
  it('переносит запись и сбрасывает отметки напоминаний', async () => {
    const { app, booking, notifier } = await withBooking()
    app.state.bookings = app.state.bookings.map(b => ({ ...b, reminderDaySentAt: new Date(NOW), reminder30mSentAt: new Date(NOW) }))
    const res = await app.app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.manageToken}/reschedule`,
      payload: { startsAt: at('16:00') },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<BookingDto>()).toMatchObject({ startsAt: '2026-10-12T11:00:00.000Z', endsAt: '2026-10-12T12:00:00.000Z', totalPrice: booking.totalPrice })
    const stored = app.state.bookings.find(b => b.id === booking.id)
    expect(stored?.reminderDaySentAt).toBeNull()
    expect(stored?.reminder30mSentAt).toBeNull()
    expect(notifier.bookingRescheduled).toHaveBeenCalledWith(expect.objectContaining({ id: booking.id }), new Date(at('12:00')))
  })

  it('можно сдвинуть запись внутри собственного интервала', async () => {
    const { app, booking } = await withBooking()
    const res = await app.app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.manageToken}/reschedule`,
      payload: { startsAt: at('12:30') },
    })
    expect(res.statusCode).toBe(200)
  })

  it('на занятое время → 409 SLOT_TAKEN, в обед → 422', async () => {
    const { app, booking } = await withBooking()
    await app.app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      payload: { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt: at('17:00'), client },
    })
    const taken = await app.app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/reschedule`, payload: { startsAt: at('16:30') } })
    expect(taken.statusCode).toBe(409)
    const lunch = await app.app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/reschedule`, payload: { startsAt: at('13:30') } })
    expect(lunch.json()).toMatchObject({ code: 'OUTSIDE_WORKING_HOURS' })
  })

  it('после cutoff → CUTOFF_PASSED; завершённую — BOOKING_NOT_ACTIVE', async () => {
    const { app, booking } = await withBooking()
    setBookingStatus(app.state, booking.id, 'completed')
    const done = await app.app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/reschedule`, payload: { startsAt: at('16:00') } })
    expect(done.json()).toMatchObject({ code: 'BOOKING_NOT_ACTIVE' })
    setBookingStatus(app.state, booking.id, 'confirmed')
    const later = await withNow(app, tashkent(MONDAY, '11:31'))
    const late = await later.app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/reschedule`, payload: { startsAt: at('16:00') } })
    expect(late.json()).toMatchObject({ code: 'CUTOFF_PASSED' })
  })

  it('неверное тело → 422', async () => {
    const { app, booking } = await withBooking()
    const res = await app.app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/reschedule`, payload: { startsAt: 'завтра' } })
    expect(res.statusCode).toBe(422)
  })
})
