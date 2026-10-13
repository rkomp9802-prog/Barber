/**
 * Интеграционные тесты с настоящим PostgreSQL. Запускаются только при TEST_DATABASE_URL.
 *
 * Подготовка (отдельная тестовая база! таблицы очищаются):
 *   DIRECT_URL=$TEST_DATABASE_URL npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://... npm run test -w @barber/api
 */
import type { BookingDto } from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app'
import { createDb, type Db } from '../../src/db/prisma'
import { isExclusionViolation } from '../../src/errors'
import { createPrismaRepositories } from '../../src/repositories/prisma'
import { MONDAY, NOW, tashkent } from '../fixtures/calendar'
import { IDS, TEST_CONFIG } from '../fakes/seed-state'

const DATABASE_URL = process.env.TEST_DATABASE_URL
const TABLES = 'reviews, booking_services, bookings, clients, time_off, breaks, working_hours, barber_services, portfolio_items, barbers, services, settings'
const client = { name: 'Иван', phone: '+998901234567' }
const at = (hhmm: string): string => new Date(tashkent(MONDAY, hhmm)).toISOString()

async function seedMinimal(db: Db): Promise<void> {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES} CASCADE`)
  await db.service.create({ data: { id: IDS.haircut, name: 'Мужская стрижка', durationMin: 60, price: 120_000 } })
  for (const [index, [id, name]] of [[IDS.timur, 'Тимур'], [IDS.aziz, 'Азиз']].entries()) {
    await db.barber.create({ data: { id: id ?? '', name: name ?? '', sortOrder: index } })
    await db.barberService.create({ data: { barberId: id ?? '', serviceId: IDS.haircut } })
    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
      await db.workingHour.create({ data: { barberId: id ?? '', weekday, startTime: '10:00', endTime: '21:00' } })
      await db.break.create({ data: { barberId: id ?? '', weekday, startTime: '14:00', endTime: '15:00' } })
    }
  }
}

describe.skipIf(!DATABASE_URL)('PostgreSQL: запись, отмена, перенос, гонка', () => {
  let db: Db
  let app: FastifyInstance

  beforeAll(async () => {
    db = createDb({ connectionString: DATABASE_URL ?? '', poolMax: 10 })
    const [row] = await db.$queryRaw<{ exists: boolean }[]>`SELECT to_regclass('public.bookings') IS NOT NULL AS exists`
    if (!row?.exists) throw new Error('Тестовая база без миграций: выполните prisma migrate deploy')
    app = await buildApp({ config: TEST_CONFIG, repos: createPrismaRepositories(db), now: () => NOW, logger: false })
  })

  afterAll(async () => {
    await app?.close()
    await db?.$disconnect()
  })

  beforeEach(async () => {
    await seedMinimal(db)
  })

  const create = (body: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/v1/bookings', payload: body })
  const haircutAt = (hhmm: string, barberId: string = IDS.timur) => ({ serviceIds: [IDS.haircut], barberId, startsAt: at(hhmm), client })

  it('создаёт запись со снимком услуг и time_range', async () => {
    const res = await create(haircutAt('10:00'))
    expect(res.statusCode).toBe(201)
    const id = res.json<BookingDto>().id
    const stored = await db.booking.findUniqueOrThrow({ where: { id }, include: { services: true } })
    expect(stored.services).toEqual([expect.objectContaining({ name: 'Мужская стрижка', price: 120_000, durationMin: 60 })])
    const [range] = await db.$queryRaw<{ r: string }[]>`SELECT time_range::text AS r FROM bookings WHERE id = ${id}::uuid`
    expect(range?.r).toContain('2026-10-12 05:00:00+00')
  })

  it('гонка: два параллельных запроса на один слот → ровно один 201 и один 409', async () => {
    const results = await Promise.all([create(haircutAt('12:00')), create(haircutAt('12:00'))])
    expect(results.map(r => r.statusCode).sort()).toEqual([201, 409])
    expect(results.find(r => r.statusCode === 409)?.json()).toMatchObject({ code: 'SLOT_TAKEN' })
    expect(await db.booking.count({ where: { status: 'confirmed' } })).toBe(1)
  })

  it('гонка из пяти пересекающихся запросов → один 201', async () => {
    const starts = ['16:00', '16:15', '16:30', '16:00', '16:45']
    const results = await Promise.all(starts.map(s => create(haircutAt(s))))
    expect(results.filter(r => r.statusCode === 201)).toHaveLength(1)
    expect(results.filter(r => r.statusCode === 409)).toHaveLength(4)
  })

  it('exclusion constraint: пересечение confirmed запрещено, с cancelled — разрешено', async () => {
    const first = (await create(haircutAt('11:00'))).json<BookingDto>()
    const clientRow = await db.client.findFirstOrThrow()
    const overlap = {
      clientId: clientRow.id, barberId: IDS.timur, startsAt: new Date(at('11:30')), endsAt: new Date(at('12:30')),
      totalPrice: 1, totalDurationMin: 60, manageToken: `t-${Date.now()}`,
    }
    const error = await db.booking.create({ data: overlap }).catch((e: unknown) => e)
    expect(isExclusionViolation(error)).toBe(true)
    await db.booking.update({ where: { id: first.id }, data: { status: 'cancelled' } })
    await expect(db.booking.create({ data: overlap })).resolves.toMatchObject({ status: 'confirmed' })
  })

  it('отмена освобождает слот', async () => {
    const booking = (await create(haircutAt('10:00'))).json<BookingDto>()
    const cancel = await app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/cancel` })
    expect(cancel.json()).toMatchObject({ status: 'cancelled' })
    expect((await create(haircutAt('10:00'))).statusCode).toBe(201)
  })

  it('перенос меняет время и сбрасывает reminder_*_sent_at', async () => {
    const booking = (await create(haircutAt('10:00'))).json<BookingDto>()
    await db.booking.update({ where: { id: booking.id }, data: { reminderDaySentAt: new Date(), reminder30mSentAt: new Date() } })
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/bookings/${booking.manageToken}/reschedule`,
      payload: { startsAt: at('17:00') },
    })
    expect(res.statusCode).toBe(200)
    const stored = await db.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(stored.startsAt.toISOString()).toBe(at('17:00'))
    expect(stored.reminderDaySentAt).toBeNull()
    expect(stored.reminder30mSentAt).toBeNull()
  })

  it('перенос на занятое время → 409', async () => {
    const booking = (await create(haircutAt('10:00'))).json<BookingDto>()
    await create(haircutAt('18:00'))
    const res = await app.inject({ method: 'POST', url: `/api/v1/bookings/${booking.manageToken}/reschedule`, payload: { startsAt: at('18:30') } })
    expect(res.statusCode).toBe(409)
  })

  it('time_off барбера и закрытие салона убирают слоты', async () => {
    await db.timeOff.create({ data: { barberId: IDS.timur, startsAt: new Date(at('00:00')), endsAt: new Date(at('23:59')), type: 'vacation' } })
    const res = await create(haircutAt('10:00'))
    expect(res.json()).toMatchObject({ code: 'OUTSIDE_WORKING_HOURS' })
    const any = await create(haircutAt('10:00', 'any'))
    expect(any.json<BookingDto>().barber.id).toBe(IDS.aziz)
    await db.timeOff.create({ data: { barberId: null, startsAt: new Date(at('00:00')), endsAt: new Date(at('23:59')), type: 'shop_closed' } })
    const slots = await app.inject({ method: 'GET', url: `/api/v1/availability?serviceIds=${IDS.haircut}&barberId=any&date=${MONDAY}` })
    expect(slots.json()).toMatchObject({ slots: [] })
  })
})
