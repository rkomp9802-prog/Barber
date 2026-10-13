import type { FastifyInstance } from 'fastify'
import { buildApp, type AppHttpConfig } from '../../src/app'
import type { Notifier } from '../../src/notifications/notifier'
import { TEST_BOT_TOKEN } from '../fixtures/telegram'
import { createMemoryRepositories, type MemoryState } from './memory-repositories'

export const IDS = {
  haircut: '11111111-1111-4111-8111-111111111111',
  beard: '22222222-2222-4222-8222-222222222222',
  shave: '33333333-3333-4333-8333-333333333333',
  timur: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  aziz: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  rustam: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
} as const

const WEEK = [0, 1, 2, 3, 4, 5, 6]
const BARBER_IDS = [IDS.timur, IDS.aziz, IDS.rustam]

/** Небольшой барбершоп: 3 услуги, 3 барбера, 10:00–21:00 каждый день, обед 14–15. */
export function demoState(): MemoryState {
  const barber = (id: string, name: string, sortOrder: number) => ({
    id, name, role: 'Барбер', bio: '', photoUrl: null, experienceYears: 3, isActive: true, sortOrder,
  })
  const service = (id: string, name: string, durationMin: number, price: number, sortOrder: number) => ({
    id, name, description: '', durationMin, price, isActive: true, sortOrder,
  })
  const link = (barberId: string, serviceId: string, extra = {}) => ({
    barberId, serviceId, durationMin: null, price: null, isEnabled: true, ...extra,
  })
  return {
    services: [
      service(IDS.haircut, 'Мужская стрижка', 60, 120_000, 1),
      service(IDS.beard, 'Оформление бороды', 30, 70_000, 2),
      service(IDS.shave, 'Королевское бритьё', 45, 100_000, 3),
    ],
    barbers: [barber(IDS.timur, 'Тимур', 1), barber(IDS.aziz, 'Азиз', 2), barber(IDS.rustam, 'Рустам', 3)],
    links: [
      link(IDS.timur, IDS.haircut, { price: 150_000 }),
      link(IDS.timur, IDS.beard),
      link(IDS.aziz, IDS.haircut),
      link(IDS.aziz, IDS.beard, { durationMin: 45 }),
      link(IDS.rustam, IDS.shave),
    ],
    hours: BARBER_IDS.flatMap(barberId => WEEK.map(weekday => ({ barberId, weekday, startTime: '10:00', endTime: '21:00' }))),
    breaks: BARBER_IDS.flatMap(barberId => WEEK.map(weekday => ({ barberId, weekday, startTime: '14:00', endTime: '15:00' }))),
    timeOff: [],
    settings: {},
    clients: [],
    bookings: [],
    reviews: [],
  }
}

export const TEST_CONFIG: AppHttpConfig = {
  corsOrigins: ['http://localhost:3000'],
  telegram: { botToken: TEST_BOT_TOKEN, botUsername: 'sharp_test_bot', initDataMaxAgeSec: 86_400 },
  rateLimit: { globalMax: 1000, bookingMax: 1000 },
  trustProxy: false,
  logLevel: 'silent',
}

export type TestApp = { app: FastifyInstance; state: MemoryState }

export async function createTestApp(options: {
  now: number
  notifier?: Notifier
  config?: Partial<AppHttpConfig>
  state?: MemoryState
}): Promise<TestApp> {
  const state = options.state ?? demoState()
  const app = await buildApp({
    config: { ...TEST_CONFIG, ...options.config },
    repos: createMemoryRepositories(state),
    notifier: options.notifier,
    now: () => options.now,
    logger: false,
  })
  return { app, state }
}
