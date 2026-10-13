import { Composer, type Context } from 'grammy'
import { loadRules } from '../../services/context'
import type { BotDeps, TelegramActor } from '../deps'
import { mainMenu } from '../keyboards'
import { BOOKING_START_PREFIX, linkBookingToTelegram } from '../link-booking'
import { BARBER_START_PREFIX, isWellFormedBarberLinkCode } from '../link-codes'
import { texts } from '../texts'
import { REVIEW_START_PREFIX } from './reviews'

const HTML = { parse_mode: 'HTML' } as const

/** Кто пишет боту. В личном чате chat.id совпадает с from.id, но храним оба явно. */
export function actorOf(ctx: Context): TelegramActor | null {
  if (!ctx.from || !ctx.chat) return null
  return { telegramId: BigInt(ctx.from.id), chatId: BigInt(ctx.chat.id) }
}

/** Если клиент с этим Telegram уже есть — запоминаем чат, чтобы до него доходили уведомления. */
async function rememberChat(deps: BotDeps, actor: TelegramActor): Promise<void> {
  const client = await deps.repo.findClientByTelegramId(actor.telegramId)
  if (client && client.telegramChatId !== actor.chatId) await deps.repo.updateClientChat(client.id, actor.chatId)
}

async function greet(ctx: Context, deps: BotDeps, actor: TelegramActor): Promise<void> {
  await rememberChat(deps, actor)
  await ctx.reply(texts.greeting(ctx.from?.first_name ?? ''), { ...HTML, reply_markup: mainMenu(deps.miniAppUrl) })
}

async function linkBooking(ctx: Context, deps: BotDeps, actor: TelegramActor, token: string): Promise<void> {
  const result = await linkBookingToTelegram({ repo: deps.repo, bookings: deps.ctx.repos.bookings }, token, actor)
  if (result.kind === 'not_found') {
    await ctx.reply(texts.bookingNotFound, { reply_markup: mainMenu(deps.miniAppUrl) })
    return
  }
  if (result.kind === 'conflict') {
    await ctx.reply(texts.bookingLinkConflict, { reply_markup: mainMenu(deps.miniAppUrl) })
    return
  }
  const rules = await loadRules(deps.ctx)
  await ctx.reply(texts.bookingLinked(result.booking, rules.timezone), {
    ...HTML,
    reply_markup: mainMenu(deps.miniAppUrl),
  })
}

async function linkBarber(ctx: Context, deps: BotDeps, actor: TelegramActor, code: string): Promise<void> {
  const consumed = isWellFormedBarberLinkCode(code)
    ? await deps.repo.consumeBarberLinkCode(code, new Date(deps.ctx.now()), actor.chatId)
    : null
  if (!consumed) {
    await ctx.reply(texts.barberLinkInvalid)
    return
  }
  deps.log.info({ barberId: consumed.barberId }, 'Барбер привязал Telegram')
  await ctx.reply(texts.barberLinked(consumed.barberName), HTML)
}

/** /start и deep links: b_<manageToken>, barber_<code>, rv_<bookingId> (ссылка из вопроса о комментарии). */
export function startHandlers(deps: BotDeps): Composer<Context> {
  const composer = new Composer<Context>()
  composer.command('start', async ctx => {
    const actor = actorOf(ctx)
    if (!actor) return
    const payload = ctx.match.trim()
    if (payload.startsWith(BOOKING_START_PREFIX)) {
      return linkBooking(ctx, deps, actor, payload.slice(BOOKING_START_PREFIX.length))
    }
    if (payload.startsWith(BARBER_START_PREFIX)) {
      return linkBarber(ctx, deps, actor, payload.slice(BARBER_START_PREFIX.length))
    }
    if (payload.startsWith(REVIEW_START_PREFIX)) {
      await ctx.reply(texts.commentHowTo)
      return
    }
    return greet(ctx, deps, actor)
  })
  composer.command('help', async ctx => {
    const actor = actorOf(ctx)
    if (actor) await greet(ctx, deps, actor)
  })
  return composer
}
