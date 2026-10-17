import type {
  CancellationsAnalyticsDto,
  HeatmapAnalyticsDto,
  LoadAnalyticsDto,
  RetentionAnalyticsDto,
  RevenueAnalyticsDto,
  ServicesAnalyticsDto,
  BookingStatus,
} from '@barber/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { MONDAY, SUNDAY, tashkent } from '../fixtures/calendar'
import { IDS } from '../fakes/seed-state'
import { createAdminState, type AdminMemoryState } from './fakes'
import { adminInject, createAdminTestApp, loginCookie, type AdminTestApp } from './harness'

/**
 * Сверка аналитики «вручную» (tasks-final.md этап 10): на маленьком наборе записей
 * все ожидаемые цифры посчитаны в комментариях и сравниваются с ответами API.
 */

const NOW = tashkent('2026-10-20', '09:00')
const PERIOD = `from=${MONDAY}&to=${SUNDAY}`
const CLIENT = {
  anvar: 'cccccccc-0001-4ccc-8ccc-cccccccccccc',
  bekzod: 'cccccccc-0002-4ccc-8ccc-cccccccccccc',
  dilshod: 'cccccccc-0003-4ccc-8ccc-cccccccccccc',
  farrukh: 'cccccccc-0004-4ccc-8ccc-cccccccccccc',
} as const

const BARBER_NAME: Record<string, string> = { [IDS.timur]: 'Тимур', [IDS.aziz]: 'Азиз', [IDS.rustam]: 'Рустам' }
const SERVICE = {
  haircut: { serviceId: IDS.haircut, name: 'Мужская стрижка', durationMin: 60 },
  beard: { serviceId: IDS.beard, name: 'Оформление бороды', durationMin: 30 },
  shave: { serviceId: IDS.shave, name: 'Королевское бритьё', durationMin: 45 },
} as const

type Line = { readonly service: keyof typeof SERVICE; readonly price: number }

let seq = 0
function booking(
  clientId: string,
  barberId: string,
  dateKey: string,
  hhmm: string,
  status: BookingStatus,
  lines: readonly Line[],
): AdminMemoryState['bookings'][number] {
  seq += 1
  const services = lines.map(line => ({ ...SERVICE[line.service], price: line.price }))
  const totalDurationMin = services.reduce((sum, item) => sum + item.durationMin, 0)
  const startsAt = new Date(tashkent(dateKey, hhmm))
  return {
    id: `eeeeeeee-${String(seq).padStart(4, '0')}-4eee-8eee-eeeeeeeeeeee`,
    clientId,
    barberId,
    barberName: BARBER_NAME[barberId] ?? '',
    client: { name: 'Клиент', phone: '+998900000000' },
    status,
    holdExpiresAt: null,
    source: 'web',
    startsAt,
    endsAt: new Date(startsAt.getTime() + totalDurationMin * 60_000),
    totalPrice: services.reduce((sum, item) => sum + item.price, 0),
    totalDurationMin,
    manageToken: `token-${seq}`,
    services,
    createdAt: new Date(NOW - 7 * 86_400_000),
    reminderDaySentAt: null,
    reminder30mSentAt: null,
  }
}

/**
 * Неделя 12–18 октября 2026 (пн–вс), время — Ташкент:
 *  1. Анвар, Тимур,  пн 10:00, completed — стрижка 150 000 (60 мин)
 *  2. Бекзод, Азиз,  вт 12:00, completed — стрижка 120 000 + борода 70 000 (90 мин)
 *  3. Анвар, Рустам, вт 12:00, completed — бритьё 100 000 (45 мин)
 *  4. Дилшод, Азиз,  ср 16:00, cancelled — стрижка 120 000
 *  5. Дилшод, Тимур, чт 10:00, no_show  — стрижка 150 000
 *  6. Фаррух, Рустам, сб 19:00, completed — бритьё 100 000 (45 мин)
 * Вне периода: Бекзод 5 октября completed (прошлый визит) и Анвар 19 октября completed (после периода).
 */
function weekState(state: AdminMemoryState): void {
  state.bookings = [
    booking(CLIENT.anvar, IDS.timur, MONDAY, '10:00', 'completed', [{ service: 'haircut', price: 150_000 }]),
    booking(CLIENT.bekzod, IDS.aziz, '2026-10-13', '12:00', 'completed', [
      { service: 'haircut', price: 120_000 },
      { service: 'beard', price: 70_000 },
    ]),
    booking(CLIENT.anvar, IDS.rustam, '2026-10-13', '12:00', 'completed', [{ service: 'shave', price: 100_000 }]),
    booking(CLIENT.dilshod, IDS.aziz, '2026-10-14', '16:00', 'cancelled', [{ service: 'haircut', price: 120_000 }]),
    booking(CLIENT.dilshod, IDS.timur, '2026-10-15', '10:00', 'no_show', [{ service: 'haircut', price: 150_000 }]),
    booking(CLIENT.farrukh, IDS.rustam, '2026-10-17', '19:00', 'completed', [{ service: 'shave', price: 100_000 }]),
    booking(CLIENT.bekzod, IDS.timur, '2026-10-05', '10:00', 'completed', [{ service: 'haircut', price: 150_000 }]),
    booking(CLIENT.anvar, IDS.timur, '2026-10-19', '10:00', 'completed', [{ service: 'haircut', price: 150_000 }]),
  ]
}

let t: AdminTestApp | undefined
afterEach(async () => {
  await t?.app.close()
  t = undefined
})

async function withWeek(fill: (state: AdminMemoryState) => void = weekState): Promise<{ app: AdminTestApp; cookie: string }> {
  const state = await createAdminState()
  fill(state)
  t = await createAdminTestApp({ now: NOW, state })
  return { app: t, cookie: await loginCookie(t.app) }
}

async function get<T>(path: string, fill?: (state: AdminMemoryState) => void): Promise<T> {
  const { app, cookie } = await withWeek(fill)
  const res = await adminInject(app.app, 'GET', path, { cookie })
  expect(res.statusCode).toBe(200)
  return res.json<T>()
}

describe('аналитика: сверка с ручным расчётом', () => {
  it('выручка: только completed за период; средний чек округлён', async () => {
    // 150 000 + 190 000 + 100 000 + 100 000 = 540 000; 4 записи; 540 000 / 4 = 135 000
    expect(await get<RevenueAnalyticsDto>(`/analytics/revenue?${PERIOD}`)).toEqual({
      totalRevenue: 540_000,
      completedCount: 4,
      averageCheck: 135_000,
    })
  })

  it('популярные услуги: доли от всех оказанных услуг, при равенстве — по алфавиту', async () => {
    // стрижка 2, бритьё 2, борода 1 → всего 5 → 40 / 40 / 20 %
    expect(await get<ServicesAnalyticsDto>(`/analytics/services?${PERIOD}`)).toEqual({
      services: [
        { serviceId: IDS.shave, serviceName: 'Королевское бритьё', bookingsCount: 2, sharePercent: 40 },
        { serviceId: IDS.haircut, serviceName: 'Мужская стрижка', bookingsCount: 2, sharePercent: 40 },
        { serviceId: IDS.beard, serviceName: 'Оформление бороды', bookingsCount: 1, sharePercent: 20 },
      ],
    })
  })

  it('загрузка барберов: минуты, записи и выручка по completed, по убыванию выручки', async () => {
    expect(await get<LoadAnalyticsDto>(`/analytics/load?${PERIOD}`)).toEqual({
      barbers: [
        { barberId: IDS.rustam, barberName: 'Рустам', workedMinutes: 90, completedCount: 2, revenue: 200_000 },
        { barberId: IDS.aziz, barberName: 'Азиз', workedMinutes: 90, completedCount: 1, revenue: 190_000 },
        { barberId: IDS.timur, barberName: 'Тимур', workedMinutes: 60, completedCount: 1, revenue: 150_000 },
      ],
    })
  })

  it('отмены и неявки: доли от всех 6 записей периода', async () => {
    // 1 / 6 = 16,67 % → 16,7
    expect(await get<CancellationsAnalyticsDto>(`/analytics/cancellations?${PERIOD}`)).toEqual({
      cancelledCount: 1,
      noShowCount: 1,
      totalBookings: 6,
      cancelledPercent: 16.7,
      noShowPercent: 16.7,
    })
  })

  it('возвращаемость: учитывает прошлые визиты и не видит визиты после периода', async () => {
    // Анвар — 2 визита в периоде, Бекзод — 1 в периоде + 1 раньше, Фаррух — 1 → 2 вернувшихся из 3
    expect(await get<RetentionAnalyticsDto>(`/analytics/retention?${PERIOD}`)).toEqual({
      oneTimeClients: 1,
      returningClients: 2,
      retentionRate: 66.7,
    })
  })

  it('heatmap: день недели с понедельника и час по Ташкенту', async () => {
    expect(await get<HeatmapAnalyticsDto>(`/analytics/heatmap?${PERIOD}`)).toEqual({
      cells: [
        { dayOfWeek: 0, hour: 10, bookingsCount: 1 },
        { dayOfWeek: 1, hour: 12, bookingsCount: 2 },
        { dayOfWeek: 5, hour: 19, bookingsCount: 1 },
      ],
    })
  })

  it('период из одного дня берёт весь местный день', async () => {
    const revenue = await get<RevenueAnalyticsDto>('/analytics/revenue?from=2026-10-13&to=2026-10-13')
    expect(revenue).toEqual({ totalRevenue: 290_000, completedCount: 2, averageCheck: 145_000 })
  })

  it('пустой период — нули без деления на ноль', async () => {
    const fill = (state: AdminMemoryState) => {
      state.bookings = []
    }
    expect(await get<RevenueAnalyticsDto>(`/analytics/revenue?${PERIOD}`, fill)).toEqual({
      totalRevenue: 0,
      completedCount: 0,
      averageCheck: 0,
    })
    await t?.app.close()
    expect(await get<RetentionAnalyticsDto>(`/analytics/retention?${PERIOD}`, fill)).toEqual({
      oneTimeClients: 0,
      returningClients: 0,
      retentionRate: 0,
    })
  })
})

describe('аналитика: доступ и проверка периода', () => {
  it('без сессии → 401', async () => {
    const { app } = await withWeek()
    const res = await adminInject(app.app, 'GET', `/analytics/revenue?${PERIOD}`)
    expect(res.statusCode).toBe(401)
  })

  it.each([
    ['без периода', ''],
    ['неверный формат', 'from=12.10.2026&to=2026-10-18'],
    ['несуществующая дата', 'from=2026-02-30&to=2026-03-02'],
    ['начало позже конца', 'from=2026-10-18&to=2026-10-12'],
    ['дольше 366 дней', 'from=2025-01-01&to=2026-10-18'],
  ])('%s → 422', async (_name, query) => {
    const { app, cookie } = await withWeek()
    const res = await adminInject(app.app, 'GET', `/analytics/load?${query}`, { cookie })
    expect(res.statusCode).toBe(422)
  })
})
