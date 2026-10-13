/**
 * Наполняет базу демо-данными: npm run db:seed -w @barber/api
 * Идемпотентно: повторный запуск обновляет те же строки, а не создаёт дубликаты.
 */
import { DEFAULT_SETTINGS } from '@barber/shared'
import { hash } from '@node-rs/argon2'
import { existsSync } from 'node:fs'
import { createDb, type Db } from '../src/db/prisma'
import { generateManageToken } from '../src/lib/tokens'
import { BARBERS, LUNCH, REVIEWS, SERVICES, WEEKLY_HOURS, stableUuid, type SeedReview } from './seed-data'

const MIN_ADMIN_PASSWORD = 8
const MINUTE_MS = 60_000

function log(message: string): void {
  process.stdout.write(`${message}\n`)
}

const serviceId = (slug: string): string => stableUuid(`service:${slug}`)
const barberId = (slug: string): string => stableUuid(`barber:${slug}`)

async function seedServices(db: Db): Promise<void> {
  for (const [index, s] of SERVICES.entries()) {
    const data = { name: s.name, description: s.description, durationMin: s.durationMin, price: s.price, sortOrder: index + 1 }
    await db.service.upsert({ where: { id: serviceId(s.slug) }, create: { id: serviceId(s.slug), ...data }, update: data })
  }
  log(`Услуги: ${SERVICES.length}`)
}

async function seedBarbers(db: Db): Promise<void> {
  for (const [index, b] of BARBERS.entries()) {
    const id = barberId(b.slug)
    const data = { name: b.name, role: b.role, bio: b.bio, experienceYears: b.experienceYears, sortOrder: index + 1 }
    await db.barber.upsert({ where: { id }, create: { id, ...data }, update: data })
    for (const slug of b.serviceSlugs) {
      const key = { barberId: id, serviceId: serviceId(slug) }
      await db.barberService.upsert({ where: { barberId_serviceId: key }, create: key, update: { isEnabled: true } })
    }
    await seedSchedule(db, b.slug, b.worksOnSunday)
  }
  log(`Барберы: ${BARBERS.length} (график и обеды)`)
}

async function seedSchedule(db: Db, slug: string, worksOnSunday: boolean): Promise<void> {
  const id = barberId(slug)
  const days = WEEKLY_HOURS.filter(day => worksOnSunday || day.weekday !== 0)
  for (const day of days) {
    const hoursId = stableUuid(`hours:${slug}:${day.weekday}`)
    const hours = { barberId: id, weekday: day.weekday, startTime: day.startTime, endTime: day.endTime }
    await db.workingHour.upsert({ where: { id: hoursId }, create: { id: hoursId, ...hours }, update: hours })
    const breakId = stableUuid(`break:${slug}:${day.weekday}`)
    const lunch = { barberId: id, weekday: day.weekday, ...LUNCH }
    await db.break.upsert({ where: { id: breakId }, create: { id: breakId, ...lunch }, update: lunch })
  }
  if (!worksOnSunday) {
    await db.workingHour.deleteMany({ where: { id: stableUuid(`hours:${slug}:0`) } })
    await db.break.deleteMany({ where: { id: stableUuid(`break:${slug}:0`) } })
  }
}

async function seedSettings(db: Db): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    // Не перетираем значения, которые владелец уже поменял в админке.
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} })
  }
  log(`Настройки: ${Object.keys(DEFAULT_SETTINGS).length}`)
}

/** Завершённая запись в прошлом + отзыв, чтобы на сайте сразу были отзывы и рейтинг. */
async function seedReview(db: Db, review: SeedReview): Promise<void> {
  const service = SERVICES.find(s => s.slug === review.serviceSlug)
  if (!service) throw new Error(`Нет услуги ${review.serviceSlug}`)
  const clientId = stableUuid(`client:${review.key}`)
  const bookingId = stableUuid(`booking:${review.key}`)
  const startsAt = new Date(`${review.date}T12:00:00+05:00`)
  const client = { name: review.clientName, phone: review.clientPhone }
  await db.client.upsert({ where: { id: clientId }, create: { id: clientId, ...client }, update: client })
  await db.booking.upsert({
    where: { id: bookingId },
    update: {},
    create: {
      id: bookingId,
      clientId,
      barberId: barberId(review.barberSlug),
      startsAt,
      endsAt: new Date(startsAt.getTime() + service.durationMin * MINUTE_MS),
      totalPrice: service.price,
      totalDurationMin: service.durationMin,
      status: 'completed',
      source: 'web',
      manageToken: generateManageToken(),
      services: { create: { serviceId: serviceId(service.slug), name: service.name, durationMin: service.durationMin, price: service.price } },
    },
  })
  const data = { rating: review.rating, comment: review.comment, isPublic: true, createdAt: startsAt }
  await db.review.upsert({
    where: { bookingId },
    create: { bookingId, barberId: barberId(review.barberSlug), clientId, ...data },
    update: data,
  })
}

async function seedAdmin(db: Db): Promise<void> {
  const login = process.env.ADMIN_LOGIN?.trim()
  const password = process.env.ADMIN_PASSWORD
  if (!login || !password) {
    log('ADMIN_LOGIN / ADMIN_PASSWORD не заданы — администратор не создан')
    return
  }
  if (password.length < MIN_ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD должен быть не короче 8 символов')
  const passwordHash = await hash(password)
  await db.adminUser.upsert({ where: { login }, create: { login, passwordHash }, update: { passwordHash } })
  log(`Администратор: ${login}`)
}

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env')
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('Задайте DIRECT_URL или DATABASE_URL в apps/api/.env')
  const db = createDb({ connectionString: url, poolMax: 1 })
  try {
    await seedServices(db)
    await seedBarbers(db)
    await seedSettings(db)
    for (const review of REVIEWS) await seedReview(db, review)
    log(`Отзывы: ${REVIEWS.length}`)
    await seedAdmin(db)
    log('Готово')
  } finally {
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Seed не выполнен: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
