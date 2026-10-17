import { Writable } from 'node:stream'
import { BotError, GrammyError } from 'grammy'
import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { LOG_REDACT_PATHS } from '../../src/app'

const PHONE = '+998901234567'
const TOKEN = 'A'.repeat(43)

function capture(): { logger: pino.Logger; output: () => string } {
  let text = ''
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString()
      callback()
    },
  })
  const logger = pino({ redact: { paths: LOG_REDACT_PATHS, censor: '[скрыто]' } }, stream)
  return { logger, output: () => text }
}

function grammyError(): GrammyError {
  const payload = {
    chat_id: 1,
    text: `Клиент: Иван ${PHONE}`,
    reply_markup: { inline_keyboard: [[{ text: 'Отменить', url: `https://example.com/booking/${TOKEN}` }]] },
  }
  return new GrammyError('Call to sendMessage failed', { ok: false, error_code: 403, description: 'Forbidden: bot was blocked' }, 'sendMessage', payload)
}

describe('логи не содержат телефонов и токенов из ошибок Telegram', () => {
  it('GrammyError: payload скрыт, код ошибки остаётся', () => {
    const { logger, output } = capture()
    logger.error({ err: grammyError(), bookingId: 'b1' }, 'Не удалось отправить уведомление')
    expect(output()).not.toContain(PHONE)
    expect(output()).not.toContain(TOKEN)
    expect(output()).toContain('403')
    expect(output()).toContain('[скрыто]')
  })

  it('BotError: ни ctx, ни payload вложенной ошибки не попадают в лог', () => {
    const { logger, output } = capture()
    const ctx = { update: { message: { contact: { phone_number: PHONE } } } }
    logger.error({ err: new BotError(grammyError(), ctx as never) }, 'Ошибка обработки Telegram-обновления')
    expect(output()).not.toContain(PHONE)
    expect(output()).not.toContain(TOKEN)
  })
})
