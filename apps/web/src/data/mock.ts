import type { BarberDto, PublicReviewDto, ServiceDto } from '@barber/shared'

/*
 * Демо-каталог: им сайт пользуется, когда API недоступен (этапы 1–3 или сервер упал).
 * Данные и id совпадают с apps/api/prisma/seed-data.ts — id там выводятся из slug
 * через stableUuid(), поэтому ссылки /book?service=<id> одинаковы в демо и в живом режиме.
 */

/** id услуг = stableUuid(`service:<slug>`) из сида. */
export const MOCK_SERVICE_IDS = {
  haircut: '76711c75-8258-467b-83fa-bf124936074c',
  haircutBeard: '641b1aa1-d96b-4505-87a4-009bd972afd4',
  beard: 'df82e4db-2ea6-4516-9394-d2b18f5591e4',
  shave: '730f33c1-cdfb-43d7-829f-7000701c73bb',
  kids: '6b8452d6-6faa-462e-8639-425d92c40df5',
  grayCamo: 'b6586bb3-462d-41c0-aea9-40b930c14758',
} as const

/** id барберов = stableUuid(`barber:<slug>`) из сида. */
export const MOCK_BARBER_IDS = {
  timur: 'e7afa317-1852-4af9-93d1-31aa37d8d9b6',
  aziz: '8ccdc1f9-a42f-4f2d-868b-bf35d7e4a3bb',
  rustam: '33d923f9-4968-4160-8ba6-3d775c6cddfc',
  daniyar: '1b46a510-b8f6-4fcc-b22e-31945df1936d',
} as const

const S = MOCK_SERVICE_IDS
const B = MOCK_BARBER_IDS

export const services: readonly ServiceDto[] = [
  {
    id: S.haircut,
    name: 'Мужская стрижка',
    description: 'Консультация, мытьё головы, стрижка ножницами и машинкой, укладка.',
    durationMin: 60,
    price: 120000,
  },
  {
    id: S.haircutBeard,
    name: 'Стрижка + борода',
    description: 'Полный образ: стрижка, моделирование бороды, горячее полотенце.',
    durationMin: 90,
    price: 180000,
  },
  {
    id: S.beard,
    name: 'Оформление бороды',
    description: 'Форма, контуры опасной бритвой, уход маслом.',
    durationMin: 30,
    price: 70000,
  },
  {
    id: S.shave,
    name: 'Королевское бритьё',
    description: 'Бритьё опасной бритвой с горячими и холодными полотенцами.',
    durationMin: 45,
    price: 100000,
  },
  {
    id: S.kids,
    name: 'Детская стрижка',
    description: 'Для мальчиков до 12 лет. Спокойно, быстро и без слёз.',
    durationMin: 45,
    price: 90000,
  },
  {
    id: S.grayCamo,
    name: 'Камуфляж седины',
    description: 'Естественное тонирование седых волос, держится до 6 недель.',
    durationMin: 30,
    price: 80000,
  },
]

export const barbers: readonly BarberDto[] = [
  {
    id: B.timur,
    name: 'Тимур',
    role: 'Топ-барбер',
    bio: 'Классика и fade любой сложности. Работает с трудными вихрами.',
    photoUrl: null,
    experienceYears: 8,
    rating: 4.9,
    reviewsCount: 214,
    serviceIds: [S.haircut, S.haircutBeard, S.beard, S.shave, S.grayCamo],
    portfolio: [],
  },
  {
    id: B.aziz,
    name: 'Азиз',
    role: 'Барбер',
    bio: 'Текстурные стрижки и укладки. Подберёт форму под тип лица.',
    photoUrl: null,
    experienceYears: 5,
    rating: 4.8,
    reviewsCount: 137,
    serviceIds: [S.haircut, S.haircutBeard, S.beard, S.kids],
    portfolio: [],
  },
  {
    id: B.rustam,
    name: 'Рустам',
    role: 'Мастер бороды',
    bio: 'Борода и бритьё опасной бритвой — его главная страсть.',
    photoUrl: null,
    experienceYears: 6,
    rating: 4.9,
    reviewsCount: 168,
    serviceIds: [S.haircutBeard, S.beard, S.shave, S.grayCamo],
    portfolio: [],
  },
  {
    id: B.daniyar,
    name: 'Данияр',
    role: 'Барбер',
    bio: 'Детские и подростковые стрижки, современные короткие формы.',
    photoUrl: null,
    experienceYears: 3,
    rating: 4.7,
    reviewsCount: 82,
    serviceIds: [S.haircut, S.kids, S.beard],
    portfolio: [],
  },
]

export const reviews: readonly PublicReviewDto[] = [
  {
    id: 'demo-review-1',
    clientName: 'Шерзод',
    barberId: B.timur,
    barberName: 'Тимур',
    rating: 5,
    comment: 'Хожу к Тимуру второй год. Ни разу не пришлось ничего переделывать.',
    createdAt: '2026-09-28T09:00:00.000Z',
  },
  {
    id: 'demo-review-2',
    clientName: 'Алексей',
    barberId: B.rustam,
    barberName: 'Рустам',
    rating: 5,
    comment: 'Королевское бритьё — отдельный вид удовольствия. Рекомендую.',
    createdAt: '2026-09-22T09:00:00.000Z',
  },
  {
    id: 'demo-review-3',
    clientName: 'Бобур',
    barberId: B.aziz,
    barberName: 'Азиз',
    rating: 5,
    comment: 'Записался через сайт за минуту, пришёл — сразу сел в кресло. Стрижка огонь.',
    createdAt: '2026-09-19T09:00:00.000Z',
  },
  {
    id: 'demo-review-4',
    clientName: 'Мадина',
    barberId: B.daniyar,
    barberName: 'Данияр',
    rating: 5,
    comment: 'Сын обычно боится стричься, а тут ещё и попросил прийти снова.',
    createdAt: '2026-09-14T09:00:00.000Z',
  },
]
