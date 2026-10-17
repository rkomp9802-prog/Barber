import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizeTelegramPhone } from '../../src/telegram/confirm-booking'
import { NOW, MONDAY, tashkent } from '../fixtures/calendar'
import { IDS } from '../fakes/seed-state'
import {
  BOOKING_ID,
  CLIENT_ID,
  MANAGE_TOKEN,
  TG_USER_ID,
  addBooking,
  addClient,
  createBotHarness,
  methodCalls,
  postUpdate,
  sentTexts,
  type BotHarness,
} from './harness'
import { contactUpdate, startUpdate } from './updates'

const HOLD_MS = 10 * 60 * 1000
const TG_PHONE = '+998901112233'
const BARBER_CHAT = 777_000n

let h: BotHarness

beforeEach(async () => {
  h = await createBotHarness()
})

afterEach(async () => {
  await h.app.close()
})

/** Запись с сайта, ждущая подтверждения: гость «Азиз» без Telegram. */
function pendingBooking(holdExpiresAt = new Date(NOW + HOLD_MS)): void {
  addClient(h.state, null)
  addBooking(h.state, { status: 'pending', holdExpiresAt })
}

const booking = () => h.state.bookings.find(b => b.id === BOOKING_ID)
const tgClient = () => h.state.clients.find(c => c.telegramId === BigInt(TG_USER_ID))
const send = (update: unknown) => postUpdate(h.app, update)
const replyMarkups = () => methodCalls(h.calls, 'sendMessage').map(c => (c.payload as { reply_markup?: unknown }).reply_markup)

describe('подтверждение записи с сайта через Telegram', () => {
  it('ссылка b_<token> на pending → просьба поделиться номером, запись закреплена за этим Telegram', async () => {
    pendingBooking()
    await send(startUpdate(`b_${MANAGE_TOKEN}`))
    expect(sentTexts(h.calls)[0]).toContain('Подтвердите запись')
    expect(JSON.stringify(replyMarkups()[0])).toContain('"request_contact":true')
    expect(booking()?.status).toBe('pending')
    expect(booking()?.claimTelegramId).toBe(BigInt(TG_USER_ID))
  })

  it('свой контакт → номер подтверждён, запись подтверждена, барбер уведомлён', async () => {
    pendingBooking()
    h.extras.barberChats.set(IDS.timur, BARBER_CHAT)
    await send(startUpdate(`b_${MANAGE_TOKEN}`))
    await send(contactUpdate('998901112233'))
    expect(booking()).toMatchObject({ status: 'confirmed', holdExpiresAt: null, clientId: tgClient()?.id })
    expect(tgClient()).toMatchObject({ phone: TG_PHONE, name: 'Азиз' })
    expect(tgClient()?.phoneVerifiedAt).toBeInstanceOf(Date)
    const texts = sentTexts(h.calls)
    expect(texts.some(t => t.includes('Номер подтверждён'))).toBe(true)
    expect(texts.some(t => t.includes('Запись подтверждена!'))).toBe(true)
    const toBarber = methodCalls(h.calls, 'sendMessage').filter(c => (c.payload as { chat_id: number }).chat_id === Number(BARBER_CHAT))
    expect(toBarber).toHaveLength(1)
  })

  it('на сайте ввели другой номер → в записи номер из Telegram', async () => {
    addClient(h.state, null)
    addBooking(h.state, { status: 'pending', holdExpiresAt: new Date(NOW + HOLD_MS), client: { name: 'Азиз', phone: '+998905550000' } })
    await send(startUpdate(`b_${MANAGE_TOKEN}`))
    await send(contactUpdate('+998 90 111 22 33'))
    expect(booking()?.client.phone).toBe(TG_PHONE)
  })

  it('пересланный чужой контакт не подтверждает номер', async () => {
    pendingBooking()
    await send(startUpdate(`b_${MANAGE_TOKEN}`))
    await send(contactUpdate('998901112233', { userId: 5151 }))
    await send(contactUpdate('998901112233', { userId: null }))
    // Даже свой контакт, но пересланным сообщением — не «Поделиться номером».
    await send(contactUpdate('998901112233', { forwarded: true }))
    expect(booking()?.status).toBe('pending')
    expect(tgClient()).toBeUndefined()
    expect(sentTexts(h.calls).filter(t => t.includes('Чужой контакт не подходит'))).toHaveLength(3)
  })

  it('номер не Узбекистана → отказ, запись не подтверждена', async () => {
    pendingBooking()
    await send(startUpdate(`b_${MANAGE_TOKEN}`))
    await send(contactUpdate('79161234567'))
    expect(booking()?.status).toBe('pending')
    expect(tgClient()).toBeUndefined()
    expect(sentTexts(h.calls).at(-2)).toContain('только для номеров Узбекистана')
  })

  it('срок истёк → «время истекло», запись не закрепляется', async () => {
    pendingBooking(new Date(NOW))
    await send(startUpdate(`b_${MANAGE_TOKEN}`))
    expect(sentTexts(h.calls)[0]).toContain('Время на подтверждение истекло')
    expect(booking()?.claimTelegramId ?? null).toBeNull()
  })

  it('Telegram с уже подтверждённым номером → запись подтверждается сразу, без контакта', async () => {
    h.state.clients = [{ id: 'tg-client', name: 'Азиз', phone: TG_PHONE, telegramId: BigInt(TG_USER_ID), phoneVerifiedAt: new Date(0) }]
    addClient(h.state, null)
    addBooking(h.state, { status: 'pending', holdExpiresAt: new Date(NOW + HOLD_MS) })
    await send(startUpdate(`b_${MANAGE_TOKEN}`))
    expect(booking()).toMatchObject({ status: 'confirmed', clientId: 'tg-client' })
    expect(JSON.stringify(replyMarkups())).not.toContain('request_contact')
  })

  it('на подтверждённом номере уже 3 предстоящие записи → новую не подтверждаем', async () => {
    h.state.clients = [{ id: 'tg-client', name: 'Азиз', phone: TG_PHONE, telegramId: BigInt(TG_USER_ID), phoneVerifiedAt: new Date(0) }]
    // Три подтверждённые предстоящие записи на этот номер.
    for (const hhmm of ['12:00', '14:00', '16:00']) {
      addBooking(h.state, { clientId: 'tg-client', startsAt: new Date(tashkent(MONDAY, hhmm)) })
      h.state.bookings = h.state.bookings.map(b => (b.id === BOOKING_ID ? { ...b, id: `b-${hhmm}`, manageToken: `t-${hhmm}` } : b))
    }
    addClient(h.state, null, CLIENT_ID)
    addBooking(h.state, { status: 'pending', holdExpiresAt: new Date(NOW + HOLD_MS) })
    await send(startUpdate(`b_${MANAGE_TOKEN}`))
    expect(booking()?.status).toBe('pending')
    expect(sentTexts(h.calls)[0]).toContain('предстоящие записи')
  })

  it('контакт без записей на подтверждение (Mini App) → номер просто подтверждён', async () => {
    await send(contactUpdate('998901112233'))
    expect(tgClient()).toMatchObject({ phone: TG_PHONE })
    expect(sentTexts(h.calls)[0]).toContain('Теперь можно записываться в приложении')
  })
})

describe('normalizeTelegramPhone', () => {
  it('приводит узбекские номера к +998XXXXXXXXX и отклоняет остальные', () => {
    expect(normalizeTelegramPhone('998901112233')).toBe('+998901112233')
    expect(normalizeTelegramPhone('+998 (90) 111-22-33')).toBe('+998901112233')
    expect(normalizeTelegramPhone('79161234567')).toBeNull()
    expect(normalizeTelegramPhone('99890111223')).toBeNull()
    expect(normalizeTelegramPhone('9989011122334')).toBeNull()
    expect(normalizeTelegramPhone('')).toBeNull()
  })
})
