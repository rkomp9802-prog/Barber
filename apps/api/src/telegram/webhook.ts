import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { Bot } from 'grammy'
import type { Update } from 'grammy/types'
import { AppError } from '../errors'

/** spec §11: Telegram вызывает POST /telegram/webhook — вне /api/v1. */
export const TELEGRAM_WEBHOOK_PATH = '/telegram/webhook'
export const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token'

export type WebhookOptions = {
  readonly bot: Bot
  /** Тот же secret_token, что передан в setWebhook. */
  readonly secret: string
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest()

/** Сравнение за постоянное время (хеши одинаковой длины), чтобы секрет нельзя было подобрать по таймингу. */
export function isValidSecret(received: string | undefined, expected: string): boolean {
  if (!received) return false
  return timingSafeEqual(digest(received), digest(expected))
}

function readSecret(request: FastifyRequest): string | undefined {
  const raw = request.headers[TELEGRAM_SECRET_HEADER]
  return Array.isArray(raw) ? raw[0] : raw
}

function isUpdate(body: unknown): body is Update {
  return typeof body === 'object' && body !== null && Number.isInteger((body as { update_id?: unknown }).update_id)
}

/**
 * Маршрут webhook. Запросы без верного X-Telegram-Bot-Api-Secret-Token → 401.
 * Ошибки обработчиков логируются, а Telegram получает 200, чтобы не повторять одно и то же обновление
 * (пользователю уже ответил errorBoundary из bot.ts).
 * Глобальный rate limit выключен: все запросы идут с небольшого набора IP Telegram.
 */
export function telegramWebhookRoutes(options: WebhookOptions): FastifyPluginAsync {
  return async app => {
    app.post(TELEGRAM_WEBHOOK_PATH, { config: { rateLimit: false } }, async (request, reply) => {
      if (!isValidSecret(readSecret(request), options.secret)) throw new AppError('UNAUTHORIZED')
      if (!isUpdate(request.body)) throw new AppError('VALIDATION_ERROR', 'Ожидается Telegram Update')
      // Сбой getMe (сеть) → 500: Telegram повторит доставку позже.
      if (!options.bot.isInited()) await options.bot.init()
      try {
        await options.bot.handleUpdate(request.body)
      } catch (error: unknown) {
        request.log.error({ err: error, updateId: request.body.update_id }, 'Сбой Telegram webhook')
      }
      return reply.code(200).send({ ok: true })
    })
  }
}
