import { TELEGRAM_INIT_DATA_HEADER, type BookingDto, type PublicReviewDto } from '@barber/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { MONDAY, NOW, tashkent } from '../fixtures/calendar'
import { makeInitData } from '../fixtures/telegram'
import { setBookingStatus } from '../fakes/memory-repositories'
import { IDS, createTestApp, type TestApp } from '../fakes/seed-state'

let t: TestApp | undefined

afterEach(async () => {
  await t?.app.close()
  t = undefined
})

const client = { name: 'Азиз', phone: '+998901112233' }
const at = (hhmm: string): string => new Date(tashkent(MONDAY, hhmm)).toISOString()
const nowSec = Math.floor(NOW / 1000)
const tgUser = JSON.stringify({ id: 4242, first_name: 'Азиз' })
const validInitData = (): string => makeInitData({ auth_date: String(nowSec - 30), user: tgUser })

async function setup(): Promise<TestApp> {
  t = await createTestApp({ now: NOW })
  return t
}

function book(app: TestApp, startsAt: string, headers: Record<string, string> = {}) {
  return app.app.inject({
    method: 'POST',
    url: '/api/v1/bookings',
    payload: { serviceIds: [IDS.haircut], barberId: IDS.timur, startsAt, client },
    headers,
  })
}

describe('Telegram Mini App', () => {
  it('POST /bookings с верным initData: source telegram, клиент привязан к telegram_id', async () => {
    const app = await setup()
    const res = await book(app, at('10:00'), { [TELEGRAM_INIT_DATA_HEADER]: validInitData() })
    expect(res.statusCode).toBe(201)
    expect(res.json<BookingDto>()).toMatchObject({ source: 'telegram', client })
    expect(app.state.clients).toHaveLength(1)
    expect(app.state.clients[0]?.telegramId).toBe(4242n)
  })

  it('POST /bookings с поддельным initData → 401', async () => {
    const app = await setup()
    const forged = makeInitData({ auth_date: String(nowSec), user: tgUser }, '1:wrong-token')
    const res = await book(app, at('10:00'), { [TELEGRAM_INIT_DATA_HEADER]: forged })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('GET /me/bookings возвращает только записи этого пользователя', async () => {
    const app = await setup()
    await book(app, at('10:00'), { [TELEGRAM_INIT_DATA_HEADER]: validInitData() })
    await book(app, at('12:00')) // гость с сайта
    const res = await app.app.inject({ method: 'GET', url: '/api/v1/me/bookings', headers: { [TELEGRAM_INIT_DATA_HEADER]: validInitData() } })
    expect(res.statusCode).toBe(200)
    const list = res.json<BookingDto[]>()
    expect(list).toHaveLength(1)
    expect(list[0]?.source).toBe('telegram')
  })

  it('GET /me/bookings без initData или с устаревшим → 401', async () => {
    const app = await setup()
    expect((await app.app.inject({ method: 'GET', url: '/api/v1/me/bookings' })).statusCode).toBe(401)
    const expired = makeInitData({ auth_date: String(nowSec - 2 * 86_400), user: tgUser })
    const res = await app.app.inject({ method: 'GET', url: '/api/v1/me/bookings', headers: { [TELEGRAM_INIT_DATA_HEADER]: expired } })
    expect(res.statusCode).toBe(401)
  })
})

describe('отзывы', () => {
  async function completedBooking(app: TestApp): Promise<BookingDto> {
    const booking = (await book(app, at('10:00'))).json<BookingDto>()
    setBookingStatus(app.state, booking.id, 'completed')
    return booking
  }

  it('POST /reviews для завершённой записи, один раз', async () => {
    const app = await setup()
    const booking = await completedBooking(app)
    const payload = { manageToken: booking.manageToken, rating: 5, comment: 'Отлично!' }
    const first = await app.app.inject({ method: 'POST', url: '/api/v1/reviews', payload })
    expect(first.statusCode).toBe(201)
    const second = await app.app.inject({ method: 'POST', url: '/api/v1/reviews', payload })
    expect(second.statusCode).toBe(422)
    expect(second.json()).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Отзыв на эту запись уже оставлен' })
  })

  it('нельзя оставить отзыв до визита', async () => {
    const app = await setup()
    const booking = (await book(app, at('10:00'))).json<BookingDto>()
    const res = await app.app.inject({ method: 'POST', url: '/api/v1/reviews', payload: { manageToken: booking.manageToken, rating: 5 } })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ code: 'BOOKING_NOT_ACTIVE' })
  })

  it('оценка вне 1–5 и неизвестный токен', async () => {
    const app = await setup()
    const bad = await app.app.inject({ method: 'POST', url: '/api/v1/reviews', payload: { manageToken: 'x'.repeat(43), rating: 6 } })
    expect(bad.statusCode).toBe(422)
    const missing = await app.app.inject({ method: 'POST', url: '/api/v1/reviews', payload: { manageToken: 'x'.repeat(43), rating: 5 } })
    expect(missing.statusCode).toBe(404)
  })

  it('GET /reviews/public — только оценки не ниже review_public_min_rating; рейтинг барбера считается', async () => {
    const app = await setup()
    const good = await completedBooking(app)
    await app.app.inject({ method: 'POST', url: '/api/v1/reviews', payload: { manageToken: good.manageToken, rating: 5 } })
    const badBooking = (await book(app, at('16:00'))).json<BookingDto>()
    setBookingStatus(app.state, badBooking.id, 'completed')
    await app.app.inject({ method: 'POST', url: '/api/v1/reviews', payload: { manageToken: badBooking.manageToken, rating: 2 } })
    const res = await app.app.inject({ method: 'GET', url: '/api/v1/reviews/public' })
    const reviews = res.json<PublicReviewDto[]>()
    expect(reviews.map(r => r.rating)).toEqual([5])
    expect(reviews[0]).toMatchObject({ barberId: IDS.timur, barberName: 'Тимур' })
    const barber = await app.app.inject({ method: 'GET', url: `/api/v1/barbers/${IDS.timur}` })
    expect(barber.json()).toMatchObject({ rating: 3.5, reviewsCount: 2 })
  })

  it('отзыв с текстом не публикуется до модерации', async () => {
    const app = await setup()
    const booking = await completedBooking(app)
    const payload = { manageToken: booking.manageToken, rating: 5, comment: 'Звоните +998901112233, скидки!' }
    expect((await app.app.inject({ method: 'POST', url: '/api/v1/reviews', payload })).statusCode).toBe(201)
    expect(app.state.reviews[0]).toMatchObject({ rating: 5, isPublic: false })
    const res = await app.app.inject({ method: 'GET', url: '/api/v1/reviews/public' })
    expect(res.json<PublicReviewDto[]>()).toEqual([])
  })
})

describe('rate limit', () => {
  it('POST /bookings ограничен строже глобального лимита → 429 RATE_LIMITED', async () => {
    t = await createTestApp({ now: NOW, config: { rateLimit: { globalMax: 100, bookingMax: 2 } } })
    const codes: number[] = []
    for (const hhmm of ['10:00', '11:00', '12:00']) codes.push((await book(t, at(hhmm))).statusCode)
    expect(codes).toEqual([201, 201, 429])
    const limited = await book(t, at('16:00'))
    expect(limited.json()).toMatchObject({ code: 'RATE_LIMITED' })
  })
})
