import type { FastifyInstance } from 'fastify'
import { Api, Bot } from 'grammy'
import type { UserFromGetMe } from 'grammy/types'
import { createTelegramNotifier, type NotifierLogger } from '../../src/telegram/notifier'
import { installHandlers } from '../../src/telegram/bot'
import type { BotDeps } from '../../src/telegram/deps'
import { telegramWebhookRoutes, TELEGRAM_SECRET_HEADER } from '../../src/telegram/webhook'
import type { ServiceContext } from '../../src/services/context'
import type { Notifier } from '../../src/notifications/notifier'
import { createMemoryRepositories, type MemoryState } from '../fakes/memory-repositories'
import { createTestApp, IDS } from '../fakes/seed-state'
import { MONDAY, NOW, tashkent } from '../fixtures/calendar'
import { createFakeTelegramRepo, createTelegramExtras, type TelegramExtras } from './fake-telegram-repo'

export const BOT_ID = 999
export const BOT_USERNAME = 'sharp_test_bot'
export const WEBHOOK_SECRET = 'test-webhook-secret-0123456789'
export const APP_URL = 'https://barber.test'
export const MINIAPP_URL = 'https://miniapp.test'
export const TOKEN = '999:TEST-token-for-telegram-tests'

export const BOOKING_ID = '55555555-5555-4555-8555-555555555555'
export const MANAGE_TOKEN = 'a'.repeat(43)
export const CLIENT_ID = '66666666-6666-4666-8666-666666666666'
export const TG_USER_ID = 4242

const BOT_INFO: UserFromGetMe = {
  id: BOT_ID,
  is_bot: true,
  first_name: 'Sharp',
  username: BOT_USERNAME,
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
}

/** Один вызов Bot API, как его видит тест (без сети). */
export type ApiCall = { readonly method: string; readonly payload: unknown }

/** Перехватывает все вызовы Bot API и отвечает успехом (сеть не используется). */
export function captureApi(api: Api, calls: ApiCall[]): void {
  api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload })
    return { ok: true, result: undefined as never }
  })
}

/** Текст всех sendMessage / reply (в payload.text). */
export function sentTexts(calls: readonly ApiCall[]): string[] {
  return calls
    .filter(call => call.method === 'sendMessage')
    .map(call => (call.payload as { text: string }).text)
}

export function methodCalls(calls: readonly ApiCall[], method: string): ApiCall[] {
  return calls.filter(call => call.method === method)
}

export function createSilentLogger(): NotifierLogger & { readonly errors: unknown[] } {
  const errors: unknown[] = []
  return {
    errors,
    error: (obj: object) => {
      errors.push(obj)
    },
  }
}

export type BotHarness = {
  readonly app: FastifyInstance
  readonly state: MemoryState
  readonly extras: TelegramExtras
  readonly bot: Bot
  readonly calls: ApiCall[]
  readonly notifier: Notifier
}

/** Приложение с памятью вместо БД, бот с перехваченным API и webhook на /telegram/webhook. */
export async function createBotHarness(options: { state?: MemoryState } = {}): Promise<BotHarness> {
  const extras = createTelegramExtras()
  const bot = new Bot(TOKEN, { botInfo: BOT_INFO })
  const calls: ApiCall[] = []
  captureApi(bot.api, calls)
  const notifierLog = createSilentLogger()
  const { app, state } = await createTestApp({ now: NOW, state: options.state })
  const repos = createMemoryRepositories(state)
  const notifier = createTelegramNotifier({
    api: bot.api,
    repo: createFakeTelegramRepo(state, extras),
    settings: repos.settings,
    log: () => notifierLog,
  })
  const ctx: ServiceContext = { repos, notifier, now: () => NOW, telegramBotUsername: BOT_USERNAME }
  const deps: BotDeps = {
    ctx,
    repo: createFakeTelegramRepo(state, extras),
    miniAppUrl: MINIAPP_URL,
    appUrl: APP_URL,
    log: app.log,
  }
  installHandlers(bot, deps)
  await app.register(telegramWebhookRoutes({ bot, secret: WEBHOOK_SECRET }))
  return { app, state, extras, bot, calls, notifier }
}

/** POST /telegram/webhook с секретом (или без заголовка, если secret = null). */
export function postUpdate(app: FastifyInstance, update: unknown, secret: string | null = WEBHOOK_SECRET) {
  return app.inject({
    method: 'POST',
    url: '/telegram/webhook',
    headers: secret === null ? {} : { [TELEGRAM_SECRET_HEADER]: secret },
    payload: update as object,
  })
}

/** Клиент с Telegram-пользователем (или без него). */
export function addClient(state: MemoryState, telegramId: number | null, id = CLIENT_ID, name = 'Азиз'): void {
  state.clients = [...state.clients, { id, name, phone: '+998901112233', telegramId: telegramId === null ? null : BigInt(telegramId) }]
}

/** Подтверждённая запись барбера Тимура на 10:00 понедельника (по умолчанию). */
export function addBooking(
  state: MemoryState,
  overrides: Partial<
    Pick<MemoryState['bookings'][number], 'status' | 'clientId' | 'startsAt' | 'endsAt' | 'client' | 'holdExpiresAt'>
  > = {},
): void {
  const startsAt = overrides.startsAt ?? new Date(tashkent(MONDAY, '10:00'))
  const endsAt = overrides.endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000)
  state.bookings = [
    ...state.bookings,
    {
      id: BOOKING_ID,
      clientId: overrides.clientId ?? CLIENT_ID,
      barberId: IDS.timur,
      barberName: 'Тимур',
      client: overrides.client ?? { name: 'Азиз', phone: '+998901112233' },
      status: overrides.status ?? 'confirmed',
      source: 'web',
      startsAt,
      endsAt,
      totalPrice: 120_000,
      totalDurationMin: 60,
      manageToken: MANAGE_TOKEN,
      services: [{ serviceId: IDS.haircut, name: 'Мужская стрижка', durationMin: 60, price: 120_000 }],
      createdAt: new Date(NOW),
      holdExpiresAt: overrides.holdExpiresAt ?? null,
      reminderDaySentAt: null,
      reminder30mSentAt: null,
    },
  ]
}
