import { randomBytes } from 'node:crypto'
import type { Db } from '../db/prisma'
import type { BarberLinkCodeRepository, NewBarberLinkCode, Repositories } from '../repositories/types'

/**
 * Одноразовая привязка барбера к Telegram (spec §11: t.me/<bot>?start=barber_<oneTimeCode>).
 *
 * Как пользоваться из админки:
 *
 *   import { createBarberLinkCode } from '../telegram/link-codes'
 *   const result = await createBarberLinkCode(ctx, barberId) // ctx: ServiceContext из RouteDeps
 *   // result = { code, link, expiresAt } — link показываем админу, он передаёт его барберу.
 *
 * Барбер открывает ссылку → бот проверяет код (не истёк, не использован), записывает
 * barbers.telegram_chat_id и помечает код использованным (handlers/start.ts).
 * Новый код отменяет неиспользованные старые: если ссылка ушла не тому, достаточно выдать новую.
 */

/** Срок жизни кода. */
export const BARBER_LINK_CODE_TTL_MS = 24 * 60 * 60 * 1000
/** 18 байт → 24 символа base64url: «barber_» + код укладывается в лимит 64 символа для start. */
const CODE_BYTES = 18
const CODE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

export const BARBER_START_PREFIX = 'barber_'

export type BarberLinkCode = {
  readonly code: string
  /** t.me/<bot>?start=barber_<code>; null — TELEGRAM_BOT_USERNAME не настроен. */
  readonly link: string | null
  readonly expiresAt: Date
}

/** Минимум из ServiceContext, нужный для генерации кода. */
export type LinkCodeContext = {
  readonly repos: Pick<Repositories, 'barberLinkCodes'>
  readonly now: () => number
  readonly telegramBotUsername: string | undefined
}

export function generateBarberLinkCode(): string {
  return randomBytes(CODE_BYTES).toString('base64url')
}

export function isWellFormedBarberLinkCode(code: string): boolean {
  return CODE_PATTERN.test(code)
}

export function barberStartLink(botUsername: string | undefined, code: string): string | null {
  return botUsername ? `https://t.me/${botUsername}?start=${BARBER_START_PREFIX}${code}` : null
}

/**
 * Создаёт одноразовый код привязки барбера (живёт 24 часа) и deep link для него.
 * Существование барбера проверяет вызывающий (иначе база отклонит внешний ключ).
 */
export async function createBarberLinkCode(ctx: LinkCodeContext, barberId: string): Promise<BarberLinkCode> {
  const store = ctx.repos.barberLinkCodes
  if (!store) throw new Error('Хранилище кодов привязки барберов не подключено')
  const code = generateBarberLinkCode()
  const expiresAt = new Date(ctx.now() + BARBER_LINK_CODE_TTL_MS)
  await store.create({ code, barberId, expiresAt })
  return { code, link: barberStartLink(ctx.telegramBotUsername, code), expiresAt }
}

export class PrismaBarberLinkCodeRepository implements BarberLinkCodeRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewBarberLinkCode): Promise<void> {
    await this.db.$transaction([
      this.db.barberLinkCode.deleteMany({ where: { barberId: input.barberId, usedAt: null } }),
      this.db.barberLinkCode.create({ data: { ...input } }),
    ])
  }
}
