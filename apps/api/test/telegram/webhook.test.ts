import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BOOKING_ID, MINIAPP_URL, WEBHOOK_SECRET, addBooking, addClient, createBotHarness, methodCalls, postUpdate, sentTexts, type BotHarness } from './harness'
import { callbackUpdate, startUpdate, textUpdate } from './updates'

let h: BotHarness

beforeEach(async () => {
  h = await createBotHarness()
})

afterEach(async () => {
  await h.app.close()
})

describe('POST /telegram/webhook: секрет', () => {
  it('без заголовка X-Telegram-Bot-Api-Secret-Token → 401, обновление не обрабатывается', async () => {
    const res = await postUpdate(h.app, startUpdate(undefined), null)
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(h.calls).toHaveLength(0)
  })

  it('неверный секрет → 401', async () => {
    const res = await postUpdate(h.app, startUpdate(undefined), 'wrong-secret-0123456789')
    expect(res.statusCode).toBe(401)
    expect(h.calls).toHaveLength(0)
  })

  it('секрет той же длины, но другой → 401 (сравнение по хешам)', async () => {
    const sameLength = 'x'.repeat(WEBHOOK_SECRET.length)
    const res = await postUpdate(h.app, startUpdate(undefined), sameLength)
    expect(res.statusCode).toBe(401)
  })

  it('верный секрет → 200 и обработка обновления', async () => {
    const res = await postUpdate(h.app, startUpdate(undefined), WEBHOOK_SECRET)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    expect(sentTexts(h.calls).at(-1)).toContain('Здравствуйте')
  })

  it('тело, не похожее на Telegram Update → 422', async () => {
    const res = await postUpdate(h.app, { hello: 'world' }, WEBHOOK_SECRET)
    expect(res.statusCode).toBe(422)
  })
})

type InlineMarkup = { inline_keyboard: { text: string; web_app?: { url: string }; callback_data?: string }[][] }

describe('/start', () => {
  it('приветствие с inline-меню: «Записаться» — web_app (Mini App получит initData), «Мои записи», «Контакты»', async () => {
    addClient(h.state, 4242)
    const res = await postUpdate(h.app, startUpdate(undefined), WEBHOOK_SECRET)
    expect(res.statusCode).toBe(200)

    const message = methodCalls(h.calls, 'sendMessage').at(-1)
    const payload = message?.payload as { text: string; reply_markup: InlineMarkup }
    expect(payload.text).toContain('Здравствуйте, Азиз!')
    const buttons = payload.reply_markup.inline_keyboard.flat()
    expect(buttons.map(button => button.text)).toEqual(['✂️ Записаться', '🗓 Мои записи', '📍 Контакты'])
    expect(buttons[0]?.web_app?.url).toBe(MINIAPP_URL)
  })

  it('старая reply-клавиатура убирается, сообщение /start удаляется', async () => {
    await postUpdate(h.app, startUpdate(undefined), WEBHOOK_SECRET)
    const removal = methodCalls(h.calls, 'sendMessage')[0]?.payload as { reply_markup?: { remove_keyboard?: boolean } }
    expect(removal.reply_markup?.remove_keyboard).toBe(true)
    // Удалены: сообщение пользователя /start и служебное «Обновляем меню…».
    expect(methodCalls(h.calls, 'deleteMessage')).toHaveLength(2)
  })

  it('повторный /start удаляет прежнее меню: в чате одно меню', async () => {
    await postUpdate(h.app, startUpdate(undefined), WEBHOOK_SECRET)
    const firstMenu = h.extras.menuMessages.get(4242n)
    await postUpdate(h.app, startUpdate(undefined), WEBHOOK_SECRET)
    const deleted = methodCalls(h.calls, 'deleteMessage').map(call => (call.payload as { message_id: number }).message_id)
    expect(firstMenu).toBeDefined()
    expect(deleted).toContain(firstMenu)
    expect(h.extras.menuMessages.get(4242n)).not.toBe(firstMenu)
  })

  it('/start запоминает чат уже известного клиента (для уведомлений)', async () => {
    addClient(h.state, 4242)
    await postUpdate(h.app, startUpdate(undefined), WEBHOOK_SECRET)
    expect(h.extras.clientChats.get('66666666-6666-4666-8666-666666666666')).toBe(4242n)
  })
})

describe('меню в одном сообщении', () => {
  const edits = () => methodCalls(h.calls, 'editMessageText').map(call => call.payload as { text: string; reply_markup: InlineMarkup })

  it('«Контакты» и «‹ Меню» меняют то же сообщение, новых сообщений нет', async () => {
    await postUpdate(h.app, callbackUpdate('menu:contacts'), WEBHOOK_SECRET)
    await postUpdate(h.app, callbackUpdate('menu:home'), WEBHOOK_SECRET)
    expect(methodCalls(h.calls, 'sendMessage')).toHaveLength(0)
    const [contacts, home] = edits()
    expect(contacts?.text).toContain('Контакты барбершопа')
    expect(contacts?.reply_markup.inline_keyboard.flat().map(b => b.callback_data)).toEqual(['menu:home'])
    expect(home?.text).toContain('Здравствуйте')
  })

  it('«Мои записи» без записей предлагает записаться', async () => {
    await postUpdate(h.app, callbackUpdate('menu:bookings'), WEBHOOK_SECRET)
    const [screen] = edits()
    expect(screen?.text).toContain('Предстоящих записей нет')
    expect(screen?.reply_markup.inline_keyboard.flat()[0]?.web_app?.url).toBe(MINIAPP_URL)
  })

  it('кнопка старой reply-клавиатуры «Контакты» открывает экран и убирает клавиатуру', async () => {
    await postUpdate(h.app, textUpdate('Контакты'), WEBHOOK_SECRET)
    expect(sentTexts(h.calls).at(-1)).toContain('Контакты барбершопа')
    const removal = methodCalls(h.calls, 'sendMessage')[0]?.payload as { reply_markup?: { remove_keyboard?: boolean } }
    expect(removal.reply_markup?.remove_keyboard).toBe(true)
  })

  it('отмена из «Моих записей» идёт в том же сообщении: список → вопрос → «Запись отменена»', async () => {
    addClient(h.state, 4242)
    addBooking(h.state)
    await postUpdate(h.app, callbackUpdate('menu:bookings'), WEBHOOK_SECRET)
    await postUpdate(h.app, callbackUpdate(`cxl:${BOOKING_ID}`), WEBHOOK_SECRET)
    await postUpdate(h.app, callbackUpdate(`cxl_yes:${BOOKING_ID}`), WEBHOOK_SECRET)
    const [list, ask, done] = edits()
    expect(list?.text).toContain('Ваши предстоящие записи (1)')
    expect(ask?.text).toContain('Отменить эту запись?')
    expect(done?.text).toContain('Запись отменена.')
    expect(h.state.bookings[0]?.status).toBe('cancelled')
    expect(methodCalls(h.calls, 'sendMessage').filter(call => (call.payload as { chat_id: number }).chat_id === 4242)).toHaveLength(0)
  })
})
