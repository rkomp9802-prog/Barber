import { createHash } from 'node:crypto'

/**
 * Демо-данные барбершопа «Sharp» — те же, что в apps/web/src/data/mock.ts (этапы 1–2).
 * id детерминированные: повторный seed обновляет те же строки (идемпотентность).
 */

/** Стабильный UUID из строки-ключа (формат v4, чтобы проходил z.string().uuid()). */
export function stableUuid(key: string): string {
  const hex = createHash('sha256').update(`barber-seed:${key}`).digest('hex')
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export type SeedService = {
  slug: string
  name: string
  description: string
  durationMin: number
  price: number
}

export const SERVICES: readonly SeedService[] = [
  {
    slug: 'haircut',
    name: 'Мужская стрижка',
    description: 'Консультация, мытьё головы, стрижка ножницами и машинкой, укладка.',
    durationMin: 60,
    price: 120000,
  },
  {
    slug: 'haircut-beard',
    name: 'Стрижка + борода',
    description: 'Полный образ: стрижка, моделирование бороды, горячее полотенце.',
    durationMin: 90,
    price: 180000,
  },
  {
    slug: 'beard',
    name: 'Оформление бороды',
    description: 'Форма, контуры опасной бритвой, уход маслом.',
    durationMin: 30,
    price: 70000,
  },
  {
    slug: 'shave',
    name: 'Королевское бритьё',
    description: 'Бритьё опасной бритвой с горячими и холодными полотенцами.',
    durationMin: 45,
    price: 100000,
  },
  {
    slug: 'kids',
    name: 'Детская стрижка',
    description: 'Для мальчиков до 12 лет. Спокойно, быстро и без слёз.',
    durationMin: 45,
    price: 90000,
  },
  {
    slug: 'gray-camo',
    name: 'Камуфляж седины',
    description: 'Естественное тонирование седых волос, держится до 6 недель.',
    durationMin: 30,
    price: 80000,
  },
]

export type SeedBarber = {
  slug: string
  name: string
  role: string
  bio: string
  experienceYears: number
  serviceSlugs: readonly string[]
  worksOnSunday: boolean
}

export const BARBERS: readonly SeedBarber[] = [
  {
    slug: 'timur',
    name: 'Тимур',
    role: 'Топ-барбер',
    bio: 'Классика и fade любой сложности. Работает с трудными вихрами.',
    experienceYears: 8,
    serviceSlugs: ['haircut', 'haircut-beard', 'beard', 'shave', 'gray-camo'],
    worksOnSunday: true,
  },
  {
    slug: 'aziz',
    name: 'Азиз',
    role: 'Барбер',
    bio: 'Текстурные стрижки и укладки. Подберёт форму под тип лица.',
    experienceYears: 5,
    serviceSlugs: ['haircut', 'haircut-beard', 'beard', 'kids'],
    worksOnSunday: true,
  },
  {
    slug: 'rustam',
    name: 'Рустам',
    role: 'Мастер бороды',
    bio: 'Борода и бритьё опасной бритвой — его главная страсть.',
    experienceYears: 6,
    serviceSlugs: ['haircut-beard', 'beard', 'shave', 'gray-camo'],
    worksOnSunday: true,
  },
  {
    slug: 'daniyar',
    name: 'Данияр',
    role: 'Барбер',
    bio: 'Детские и подростковые стрижки, современные короткие формы.',
    experienceYears: 3,
    serviceSlugs: ['haircut', 'kids', 'beard'],
    worksOnSunday: false,
  },
]

/** Пн–Сб 10:00–21:00, Вс 11:00–19:00. weekday: 0 = воскресенье. */
export const WEEKLY_HOURS: readonly { weekday: number; startTime: string; endTime: string }[] = [
  { weekday: 0, startTime: '11:00', endTime: '19:00' },
  ...[1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, startTime: '10:00', endTime: '21:00' })),
]

export const LUNCH = { startTime: '14:00', endTime: '15:00' } as const

export type SeedReview = {
  key: string
  clientName: string
  clientPhone: string
  barberSlug: string
  serviceSlug: string
  rating: number
  comment: string
  /** Дата визита по Ташкенту. */
  date: string
}

/** Отзывы с лендинга. Для каждого создаётся завершённая запись в прошлом. */
export const REVIEWS: readonly SeedReview[] = [
  {
    key: 'r1',
    clientName: 'Шерзод',
    clientPhone: '+998900000001',
    barberSlug: 'timur',
    serviceSlug: 'haircut',
    rating: 5,
    comment: 'Хожу к Тимуру второй год. Ни разу не пришлось ничего переделывать.',
    date: '2026-09-28',
  },
  {
    key: 'r2',
    clientName: 'Алексей',
    clientPhone: '+998900000002',
    barberSlug: 'rustam',
    serviceSlug: 'shave',
    rating: 5,
    comment: 'Королевское бритьё — отдельный вид удовольствия. Рекомендую.',
    date: '2026-09-22',
  },
  {
    key: 'r3',
    clientName: 'Бобур',
    clientPhone: '+998900000003',
    barberSlug: 'aziz',
    serviceSlug: 'haircut',
    rating: 5,
    comment: 'Записался через сайт за минуту, пришёл — сразу сел в кресло. Стрижка огонь.',
    date: '2026-09-19',
  },
  {
    key: 'r4',
    clientName: 'Мадина',
    clientPhone: '+998900000004',
    barberSlug: 'daniyar',
    serviceSlug: 'kids',
    rating: 5,
    comment: 'Сын обычно боится стричься, а тут ещё и попросил прийти снова.',
    date: '2026-09-14',
  },
]
