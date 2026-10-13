import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MINIAPP_URL, WEBHOOK_SECRET, addClient, createBotHarness, methodCalls, postUpdate, sentTexts, type BotHarness } from './harness'
import { startUpdate } from './updates'

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
    expect(sentTexts(h.calls)).toHaveLength(1)
  })

  it('тело, не похожее на Telegram Update → 422', async () => {
    const res = await postUpdate(h.app, { hello: 'world' }, WEBHOOK_SECRET)
    expect(res.statusCode).toBe(422)
  })
})

describe('/start', () => {
  it('приветствие с меню: кнопка Mini App «Записаться» (web_app) и «Мои записи», «Контакты»', async () => {
    addClient(h.state, 4242)
    const res = await postUpdate(h.app, startUpdate(undefined), WEBHOOK_SECRET)
    expect(res.statusCode).toBe(200)

    const [message] = methodCalls(h.calls, 'sendMessage')
    const payload = message?.payload as { text: string; reply_markup: { keyboard: { text: string; web_app?: { url: string } }[][] } }
    expect(payload.text).toContain('Здравствуйте, Азиз!')
    const buttons = payload.reply_markup.keyboard.flat()
    expect(buttons.map(button => button.text)).toEqual(['Записаться', 'Мои записи', 'Контакты'])
    expect(buttons[0]?.web_app?.url).toBe(MINIAPP_URL)
  })

  it('/start запоминает чат уже известного клиента (для уведомлений)', async () => {
    addClient(h.state, 4242)
    await postUpdate(h.app, startUpdate(undefined), WEBHOOK_SECRET)
    expect(h.extras.clientChats.get('66666666-6666-4666-8666-666666666666')).toBe(4242n)
  })
})
