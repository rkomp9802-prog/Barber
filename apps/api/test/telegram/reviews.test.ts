import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BOOKING_ID, CLIENT_ID, TG_USER_ID, WEBHOOK_SECRET, addBooking, addClient, createBotHarness, methodCalls, postUpdate, sentTexts, type BotHarness } from './harness'
import { botPromptWithMarker, callbackUpdate, textUpdate } from './updates'

const OTHER_TG_USER_ID = 5151
const RATE_DATA = `rate:${BOOKING_ID}:5`

let h: BotHarness

beforeEach(async () => {
  h = await createBotHarness()
  addClient(h.state, TG_USER_ID)
})

afterEach(async () => {
  await h.app.close()
})

const send = (update: unknown) => postUpdate(h.app, update, WEBHOOK_SECRET)

/** Текст answerCallbackQuery последнего вызова (alert или обычное уведомление). */
function lastAnswer(): { text?: string; show_alert?: boolean } {
  const calls = methodCalls(h.calls, 'answerCallbackQuery')
  return (calls.at(-1)?.payload ?? {}) as { text?: string; show_alert?: boolean }
}

describe('callback rate:<bookingId>:<1-5>', () => {
  it('владелец записи, визит завершён → отзыв создан, предложен комментарий с force_reply', async () => {
    addBooking(h.state, { status: 'completed', clientId: CLIENT_ID })
    const res = await send(callbackUpdate(RATE_DATA))
    expect(res.statusCode).toBe(200)
    expect(h.state.reviews).toHaveLength(1)
    expect(h.state.reviews[0]).toMatchObject({ bookingId: BOOKING_ID, clientId: CLIENT_ID, rating: 5, comment: null })
    const prompt = methodCalls(h.calls, 'sendMessage').at(-1)?.payload as { reply_markup: { force_reply: boolean } }
    expect(prompt.reply_markup.force_reply).toBe(true)
  })

  it('чужой пользователь → отказ, отзыва нет', async () => {
    addBooking(h.state, { status: 'completed', clientId: CLIENT_ID })
    await send(callbackUpdate(RATE_DATA, OTHER_TG_USER_ID))
    expect(h.state.reviews).toHaveLength(0)
    expect(lastAnswer()).toMatchObject({ show_alert: true, text: 'Эта запись принадлежит другому клиенту.' })
  })

  it('визит ещё не завершён (confirmed) → отказ, отзыва нет', async () => {
    addBooking(h.state, { status: 'confirmed', clientId: CLIENT_ID })
    await send(callbackUpdate(RATE_DATA))
    expect(h.state.reviews).toHaveLength(0)
    expect(lastAnswer()).toMatchObject({ show_alert: true, text: 'Оценить визит можно после того, как он состоится.' })
  })

  it('повторная оценка той же записи → отказ, второго отзыва нет', async () => {
    addBooking(h.state, { status: 'completed', clientId: CLIENT_ID })
    await send(callbackUpdate(RATE_DATA))
    await send(callbackUpdate(`rate:${BOOKING_ID}:1`))
    expect(h.state.reviews).toHaveLength(1)
    expect(h.state.reviews[0]?.rating).toBe(5)
    expect(lastAnswer()).toMatchObject({ show_alert: true })
  })

  it('оценка вне диапазона 1–5 не разбирается как rate и не создаёт отзыв', async () => {
    addBooking(h.state, { status: 'completed', clientId: CLIENT_ID })
    await send(callbackUpdate(`rate:${BOOKING_ID}:9`))
    expect(h.state.reviews).toHaveLength(0)
  })
})

describe('комментарий: ответ на сообщение бота', () => {
  beforeEach(() => {
    addBooking(h.state, { status: 'completed', clientId: CLIENT_ID })
  })

  it('ответ владельца сохраняется в отзыв (один раз)', async () => {
    await send(callbackUpdate(RATE_DATA))
    await send(textUpdate('Отличная стрижка', { replyTo: botPromptWithMarker(BOOKING_ID) }))
    expect(h.state.reviews[0]?.comment).toBe('Отличная стрижка')
    // Оценка 5 была публичной; с текстом отзыв ждёт модерации.
    expect(h.state.reviews[0]?.isPublic).toBe(false)
    expect(sentTexts(h.calls).at(-1)).toContain('Комментарий сохранён')

    await send(textUpdate('Ещё раз', { replyTo: botPromptWithMarker(BOOKING_ID) }))
    expect(h.state.reviews[0]?.comment).toBe('Отличная стрижка')
    expect(sentTexts(h.calls).at(-1)).toContain('Комментарий к этому отзыву уже добавлен')
  })

  it('комментарий чужого пользователя не сохраняется', async () => {
    await send(callbackUpdate(RATE_DATA))
    await send(textUpdate('Взлом', { fromId: OTHER_TG_USER_ID, replyTo: botPromptWithMarker(BOOKING_ID) }))
    expect(h.state.reviews[0]?.comment).toBeNull()
    expect(sentTexts(h.calls).at(-1)).toContain('Эта запись принадлежит другому клиенту')
  })

  it('слишком длинный комментарий (больше 1000 символов) отклоняется', async () => {
    await send(callbackUpdate(RATE_DATA))
    await send(textUpdate('я'.repeat(1001), { replyTo: botPromptWithMarker(BOOKING_ID) }))
    expect(h.state.reviews[0]?.comment).toBeNull()
    expect(sentTexts(h.calls).at(-1)).toContain('максимум 1000 символов')
  })

  it('обычное сообщение без ответа на маркер не трогает отзывы', async () => {
    await send(callbackUpdate(RATE_DATA))
    await send(textUpdate('просто текст'))
    expect(h.state.reviews[0]?.comment).toBeNull()
    expect(sentTexts(h.calls).at(-1)).toContain('Выберите действие в меню ниже.')
  })
})
