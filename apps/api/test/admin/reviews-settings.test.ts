import type { AdminReviewDto, AdminSettingsDto, Paginated } from '@barber/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { MONDAY, tashkent } from '../fixtures/calendar'
import { IDS } from '../fakes/seed-state'
import { createAdminState, type AdminMemoryState } from './fakes'
import { adminInject, createAdminTestApp, loginCookie, type AdminTestApp } from './harness'

const NOW = tashkent(MONDAY, '09:00')
const CLIENT_ID = 'cccccccc-1111-4ccc-8ccc-cccccccccccc'
const REVIEW_PUBLIC = 'dddddddd-1111-4ddd-8ddd-dddddddddddd'
const REVIEW_HIDDEN = 'dddddddd-2222-4ddd-8ddd-dddddddddddd'

let t: AdminTestApp | undefined
afterEach(async () => {
  await t?.app.close()
  t = undefined
})

async function withReviews(): Promise<{ app: AdminTestApp; cookie: string }> {
  const state: AdminMemoryState = await createAdminState()
  state.clients = [{ id: CLIENT_ID, name: 'Анвар Каримов', phone: '+998901112233', telegramId: null }]
  const created = new Date(NOW - 1000)
  state.reviews = [
    { id: REVIEW_PUBLIC, bookingId: 'b1', barberId: IDS.timur, clientId: CLIENT_ID, rating: 5, comment: 'Супер', isPublic: true, createdAt: created },
    { id: REVIEW_HIDDEN, bookingId: 'b2', barberId: IDS.aziz, clientId: CLIENT_ID, rating: 2, comment: null, isPublic: false, createdAt: created },
  ]
  t = await createAdminTestApp({ now: NOW, state })
  return { app: t, cookie: await loginCookie(t.app) }
}

describe('отзывы', () => {
  it('список с фильтром по публичности; имя клиента и телефон видны только админу', async () => {
    const { app, cookie } = await withReviews()
    const res = await adminInject(app.app, 'GET', '/reviews?isPublic=false', { cookie })
    expect(res.statusCode).toBe(200)
    const page = res.json<Paginated<AdminReviewDto>>()
    expect(page.total).toBe(1)
    expect(page.items[0]).toMatchObject({ id: REVIEW_HIDDEN, comment: '', client: { name: 'Анвар Каримов', phone: '+998901112233' } })
  })

  it('фильтр по рейтингу: minRating > maxRating → 422', async () => {
    const { app, cookie } = await withReviews()
    const res = await adminInject(app.app, 'GET', '/reviews?minRating=5&maxRating=2', { cookie })
    expect(res.statusCode).toBe(422)
  })

  it('isPublic не true/false → 422', async () => {
    const { app, cookie } = await withReviews()
    const res = await adminInject(app.app, 'GET', '/reviews?isPublic=maybe', { cookie })
    expect(res.statusCode).toBe(422)
  })

  it('PATCH скрывает отзыв с сайта; публичный список сайта его не отдаёт', async () => {
    const { app, cookie } = await withReviews()
    const res = await adminInject(app.app, 'PATCH', `/reviews/${REVIEW_PUBLIC}`, { cookie, payload: { isPublic: false } })
    expect(res.statusCode).toBe(200)
    expect(res.json<AdminReviewDto>().isPublic).toBe(false)
    expect(app.state.reviews.find(review => review.id === REVIEW_PUBLIC)?.isPublic).toBe(false)
  })

  it('PATCH: не boolean → 422; неизвестный отзыв → 404', async () => {
    const { app, cookie } = await withReviews()
    const bad = await adminInject(app.app, 'PATCH', `/reviews/${REVIEW_PUBLIC}`, { cookie, payload: { isPublic: 'no' } })
    expect(bad.statusCode).toBe(422)
    const missing = await adminInject(app.app, 'PATCH', '/reviews/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', { cookie, payload: { isPublic: true } })
    expect(missing.statusCode).toBe(404)
  })
})

describe('настройки', () => {
  it('GET отдаёт значения по умолчанию, если в базе ничего не сохранено', async () => {
    const { app, cookie } = await withReviews()
    const res = await adminInject(app.app, 'GET', '/settings', { cookie })
    expect(res.json<AdminSettingsDto>()).toMatchObject({
      cancel_cutoff_min: 30,
      slot_step_min: 15,
      booking_horizon_days: 30,
      timezone: 'Asia/Tashkent',
      review_public_min_rating: 4,
    })
  })

  it('PUT сохраняет переданные ключи и отдаёт полный набор', async () => {
    const { app, cookie } = await withReviews()
    const res = await adminInject(app.app, 'PUT', '/settings', {
      cookie,
      payload: { booking_horizon_days: 45, timezone: 'Asia/Tashkent' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<AdminSettingsDto>()).toMatchObject({ booking_horizon_days: 45, cancel_cutoff_min: 30 })
    expect(app.state.settings).toMatchObject({ booking_horizon_days: 45, timezone: 'Asia/Tashkent' })
  })

  it('неизвестный ключ → 422', async () => {
    const { app, cookie } = await withReviews()
    const res = await adminInject(app.app, 'PUT', '/settings', { cookie, payload: { secret_mode: true } })
    expect(res.statusCode).toBe(422)
    expect(app.state.settings).toEqual({})
  })

  it('значения вне диапазона → 422 (шаг слота кратен 5, рейтинг 1–5, пояс известный)', async () => {
    const { app, cookie } = await withReviews()
    const put = (payload: Record<string, unknown>) => adminInject(app.app, 'PUT', '/settings', { cookie, payload })
    expect((await put({ slot_step_min: 7 })).statusCode).toBe(422)
    expect((await put({ review_public_min_rating: 6 })).statusCode).toBe(422)
    expect((await put({ timezone: 'Mars/Olympus' })).statusCode).toBe(422)
    expect((await put({ booking_horizon_days: 0 })).statusCode).toBe(422)
    expect((await put({ booking_horizon_days: '45' })).statusCode).toBe(422)
  })

  it('пустое тело → 422', async () => {
    const { app, cookie } = await withReviews()
    const res = await adminInject(app.app, 'PUT', '/settings', { cookie, payload: {} })
    expect(res.statusCode).toBe(422)
  })

  it('испорченное значение в базе не ломает GET: берётся значение по умолчанию', async () => {
    const { app, cookie } = await withReviews()
    app.state.settings = { slot_step_min: 'много' }
    const res = await adminInject(app.app, 'GET', '/settings', { cookie })
    expect(res.json<AdminSettingsDto>().slot_step_min).toBe(15)
  })
})
