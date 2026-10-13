import { TELEGRAM_INIT_DATA_HEADER } from '@barber/shared'
import type { FastifyRequest } from 'fastify'
import { AppError } from '../errors'
import type { ClientRecord, ClientRepository } from '../repositories/types'
import { telegramDisplayName, verifyInitData } from './telegram'

export type TelegramAuthConfig = {
  readonly botToken: string | undefined
  readonly initDataMaxAgeSec: number
}

const MS_IN_SEC = 1000

function readInitData(request: FastifyRequest): string | null {
  const raw = request.headers[TELEGRAM_INIT_DATA_HEADER]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value && value.trim() ? value : null
}

/**
 * Клиент Telegram Mini App по заголовку initData.
 * Заголовка нет → null (обычный гость сайта). Заголовок есть, но подпись неверна → 401.
 */
export async function resolveTelegramClient(
  request: FastifyRequest,
  config: TelegramAuthConfig,
  clients: ClientRepository,
  nowMs: number,
): Promise<ClientRecord | null> {
  const initData = readInitData(request)
  if (!initData) return null
  if (!config.botToken) throw new AppError('UNAUTHORIZED', 'Вход через Telegram не настроен')
  const result = verifyInitData(initData, config.botToken, Math.floor(nowMs / MS_IN_SEC), config.initDataMaxAgeSec)
  if (!result.ok) {
    request.log.info({ reason: result.reason }, 'Отклонён Telegram initData')
    throw new AppError('UNAUTHORIZED', 'Не удалось подтвердить вход через Telegram. Откройте приложение заново')
  }
  return clients.findOrCreateByTelegram({
    telegramId: BigInt(result.user.id),
    name: telegramDisplayName(result.user),
  })
}

/** То же, но initData обязателен (например, для /me/bookings). */
export async function requireTelegramClient(
  request: FastifyRequest,
  config: TelegramAuthConfig,
  clients: ClientRepository,
  nowMs: number,
): Promise<ClientRecord> {
  const client = await resolveTelegramClient(request, config, clients, nowMs)
  if (!client) throw new AppError('UNAUTHORIZED', 'Откройте приложение из Telegram')
  return client
}
