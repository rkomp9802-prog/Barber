import { Api } from 'grammy'
import { describe, expect, it } from 'vitest'
import { MONDAY, tashkent } from '../fixtures/calendar'
import { createMemoryRepositories, type MemoryState } from '../fakes/memory-repositories'
import { demoState, IDS } from '../fakes/seed-state'
import { createFakeTelegramRepo, createTelegramExtras, toPublicBooking, type TelegramExtras } from './fake-telegram-repo'
import { createTelegramNotifier, type NotifierLogger } from '../../src/telegram/notifier'
import type { BookingRecord } from '../../src/repositories/types'
import { BOOKING_ID, CLIENT_ID, addBooking, addClient, captureApi, createSilentLogger, sentTexts, type ApiCall } from './harness'

const CLIENT_CHAT = 4242n
const BARBER_CHAT = 9001n
const OLD_START = new Date(tashkent(MONDAY, '09:00'))

type Env = {
  readonly state: MemoryState
  readonly extras: TelegramExtras
  readonly calls: ApiCall[]
  readonly log: NotifierLogger & { readonly errors: unknown[] }
  readonly notifier: ReturnType<typeof createTelegramNotifier>
  readonly booking: BookingRecord
}

/** Уведомления без сети: Api с перехватом, память вместо БД, клиент и барбер с чатами. */
function setup(options: { clientChat?: bigint | null; barberChat?: bigint | null; failSend?: boolean } = {}): Env {
  const state = demoState()
  const extras = createTelegramExtras()
  addClient(state, 4242, CLIENT_ID, 'Азиз')
  addBooking(state)
  if (options.clientChat !== null) extras.clientChats.set(CLIENT_ID, options.clientChat ?? CLIENT_CHAT)
  if (options.barberChat !== null) extras.barberChats.set(IDS.timur, options.barberChat ?? BARBER_CHAT)
  const api = new Api('999:TEST-token-for-telegram-tests')
  const calls: ApiCall[] = []
  captureApi(api, calls)
  if (options.failSend) {
    api.config.use(async () => {
      throw new Error('Forbidden: bot was blocked by the user')
    })
  }
  const log = createSilentLogger()
  const notifier = createTelegramNotifier({
    api,
    repo: createFakeTelegramRepo(state, extras),
    settings: createMemoryRepositories(state).settings,
    log: () => log,
  })
  const stored = state.bookings[0]
  if (!stored) throw new Error('В тесте нет записи')
  const booking = toPublicBooking(stored)
  return { state, extras, calls, log, notifier, booking }
}

const sendCalls = (env: Env) => env.calls.filter(call => call.method === 'sendMessage')
const chatIds = (env: Env): number[] => sendCalls(env).map(call => (call.payload as { chat_id: number }).chat_id)

describe('createTelegramNotifier: подтверждение', () => {
  it('bookingCreated: клиенту и барберу, HTML и без превью ссылок', async () => {
    const env = setup()
    await env.notifier.bookingCreated(env.booking)
    expect(chatIds(env)).toEqual([Number(CLIENT_CHAT), Number(BARBER_CHAT)])
    const [clientCall, barberCall] = sendCalls(env).map(call => call.payload as { text: string; parse_mode: string; link_preview_options: { is_disabled: boolean } })
    expect(clientCall?.text).toContain('Запись подтверждена!')
    expect(clientCall?.text).toContain('10:00')
    expect(clientCall?.text).toContain('Тимур')
    expect(barberCall?.text).toContain('Новая запись')
    expect(barberCall?.text).toContain('Клиент: Азиз, +998901112233')
    expect(clientCall?.parse_mode).toBe('HTML')
    expect(clientCall?.link_preview_options.is_disabled).toBe(true)
  })

  it('клиент без telegram_chat_id пропускается, барбер получает сообщение', async () => {
    const env = setup({ clientChat: null })
    await env.notifier.bookingCreated(env.booking)
    expect(chatIds(env)).toEqual([Number(BARBER_CHAT)])
  })

  it('барбер без привязки пропускается, клиент получает сообщение', async () => {
    const env = setup({ barberChat: null })
    await env.notifier.bookingCreated(env.booking)
    expect(chatIds(env)).toEqual([Number(CLIENT_CHAT)])
  })
})

describe('createTelegramNotifier: отмена и перенос', () => {
  it('bookingCancelled: клиенту и барберу', async () => {
    const env = setup()
    await env.notifier.bookingCancelled({ ...env.booking, status: 'cancelled' })
    const texts = sentTexts(env.calls)
    expect(texts[0]).toContain('Запись отменена.')
    expect(texts[1]).toContain('Запись отменена')
    expect(texts[1]).toContain('Клиент: Азиз')
  })

  it('bookingRescheduled: показывает старое время и уходит обоим', async () => {
    const env = setup()
    await env.notifier.bookingRescheduled(env.booking, OLD_START)
    const texts = sentTexts(env.calls)
    expect(texts).toHaveLength(2)
    expect(texts[0]).toContain('Запись перенесена.')
    expect(texts[0]).toContain('Было:')
    expect(texts[0]).toContain('09:00')
    expect(texts[1]).toContain('Запись перенесена')
  })
})

describe('createTelegramNotifier: ошибки не пробрасываются', () => {
  it('сбой отправки (бот заблокирован) только логируется', async () => {
    const env = setup({ failSend: true })
    await expect(env.notifier.bookingCreated(env.booking)).resolves.toBeUndefined()
    expect(env.log.errors.length).toBeGreaterThanOrEqual(2)
    expect(env.log.errors[0]).toMatchObject({ event: 'bookingCreated', bookingId: BOOKING_ID })
  })

  it('запись, которой нет в базе, не бросает исключение', async () => {
    const env = setup()
    const ghost = { ...env.booking, clientId: '00000000-0000-4000-8000-000000000000' }
    await expect(env.notifier.bookingCancelled(ghost)).resolves.toBeUndefined()
  })
})

describe('createTelegramNotifier: экранирование', () => {
  it('имя клиента с HTML-тегами выводится экранированным', async () => {
    const env = setup()
    const hostile = { ...env.booking, client: { name: '<a href="https://evil">Азиз</a> & <b>', phone: null } }
    await env.notifier.bookingCreated(hostile)
    const barberText = sentTexts(env.calls)[1] ?? ''
    expect(barberText).toContain('&lt;a href=&quot;https://evil&quot;&gt;Азиз&lt;/a&gt; &amp; &lt;b&gt;')
    expect(barberText).not.toContain('<a href')
  })
})
