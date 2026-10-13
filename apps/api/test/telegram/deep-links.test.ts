import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NOW } from '../fixtures/calendar'
import { IDS } from '../fakes/seed-state'
import { BOOKING_ID, CLIENT_ID, MANAGE_TOKEN, TG_USER_ID, WEBHOOK_SECRET, addBooking, addClient, createBotHarness, postUpdate, sentTexts, type BotHarness } from './harness'
import { startUpdate } from './updates'

const BARBER_CODE = 'c'.repeat(24)
const OTHER_TG_USER_ID = 5151
const HOUR_MS = 60 * 60 * 1000

let h: BotHarness

beforeEach(async () => {
  h = await createBotHarness()
})

afterEach(async () => {
  await h.app.close()
})

function start(payload: string, fromId = TG_USER_ID) {
  return postUpdate(h.app, startUpdate(payload, fromId), WEBHOOK_SECRET)
}

const clientOf = (clientId: string) => h.state.clients.find(c => c.id === clientId)

describe('deep link b_<manageToken>', () => {
  it('привязывает клиента записи к Telegram-пользователю и сохраняет чат', async () => {
    addClient(h.state, null)
    addBooking(h.state)
    await start(`b_${MANAGE_TOKEN}`)
    expect(clientOf(CLIENT_ID)?.telegramId).toBe(BigInt(TG_USER_ID))
    expect(h.extras.clientChats.get(CLIENT_ID)).toBe(BigInt(TG_USER_ID))
    expect(sentTexts(h.calls)[0]).toContain('Запись привязана к Telegram')
  })

  it('неизвестный токен → «не найдено», ничего не меняется', async () => {
    addClient(h.state, null)
    addBooking(h.state)
    await start(`b_${'b'.repeat(43)}`)
    expect(clientOf(CLIENT_ID)?.telegramId).toBeNull()
    expect(sentTexts(h.calls)[0]).toContain('Запись не найдена')
  })

  it('запись клиента уже привязана к другому Telegram → конфликт', async () => {
    addClient(h.state, OTHER_TG_USER_ID)
    addBooking(h.state)
    await start(`b_${MANAGE_TOKEN}`)
    expect(clientOf(CLIENT_ID)?.telegramId).toBe(BigInt(OTHER_TG_USER_ID))
    expect(sentTexts(h.calls)[0]).toContain('уже привязана к другому аккаунту')
  })

  it('у пользователя уже есть свой клиент → запись переносится к нему', async () => {
    addClient(h.state, null)
    addClient(h.state, TG_USER_ID, '77777777-7777-4777-8777-777777777777', 'Свой')
    addBooking(h.state)
    await start(`b_${MANAGE_TOKEN}`)
    const booking = h.state.bookings.find(b => b.id === BOOKING_ID)
    expect(booking?.clientId).toBe('77777777-7777-4777-8777-777777777777')
  })
})

describe('deep link barber_<code>', () => {
  it('действующий код привязывает барбера: чат записан, код погашен', async () => {
    h.extras.linkCodes.set(BARBER_CODE, { barberId: IDS.timur, expiresAt: new Date(NOW + HOUR_MS), usedAt: null })
    await start(`barber_${BARBER_CODE}`)
    expect(h.extras.barberChats.get(IDS.timur)).toBe(BigInt(TG_USER_ID))
    expect(h.extras.linkCodes.get(BARBER_CODE)?.usedAt).toEqual(new Date(NOW))
    expect(sentTexts(h.calls)[0]).toContain('Уведомления о записях к барберу Тимур')
  })

  it('истёкший код → недействителен, барбер не привязан', async () => {
    h.extras.linkCodes.set(BARBER_CODE, { barberId: IDS.timur, expiresAt: new Date(NOW - 1), usedAt: null })
    await start(`barber_${BARBER_CODE}`)
    expect(h.extras.barberChats.has(IDS.timur)).toBe(false)
    expect(sentTexts(h.calls)[0]).toContain('Ссылка привязки недействительна')
  })

  it('уже использованный код → недействителен (второй раз не работает)', async () => {
    h.extras.linkCodes.set(BARBER_CODE, { barberId: IDS.timur, expiresAt: new Date(NOW + HOUR_MS), usedAt: null })
    await start(`barber_${BARBER_CODE}`)
    await start(`barber_${BARBER_CODE}`, OTHER_TG_USER_ID)
    expect(h.extras.barberChats.get(IDS.timur)).toBe(BigInt(TG_USER_ID))
    expect(sentTexts(h.calls)[1]).toContain('Ссылка привязки недействительна')
  })

  it('неизвестный или кривой код → недействителен', async () => {
    await start('barber_короткий')
    expect(sentTexts(h.calls)[0]).toContain('Ссылка привязки недействительна')
  })
})
