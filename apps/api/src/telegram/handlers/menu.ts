import { Composer, type Context } from 'grammy'
import { loadRules } from '../../services/context'
import { cancelOwnBooking, findOwnBooking, listUpcoming } from '../client-actions'
import type { BotDeps } from '../deps'
import { CALLBACK_PATTERNS, MENU, bookingsKeyboard, confirmCancelKeyboard, mainMenu } from '../keyboards'
import { texts } from '../texts'

const HTML = { parse_mode: 'HTML' } as const

async function showBookings(ctx: Context, deps: BotDeps): Promise<void> {
  if (!ctx.from) return
  const { items, rules } = await listUpcoming(deps, BigInt(ctx.from.id))
  if (items.length === 0) {
    await ctx.reply(texts.noUpcoming, { reply_markup: mainMenu(deps.miniAppUrl) })
    return
  }
  const body = items.map((item, index) => texts.bookingItem(index + 1, item.booking, rules.timezone)).join('\n\n')
  const text = [texts.upcomingHeader(items.length), '', body, '', texts.cutoffHint(rules.cancelCutoffMin)].join('\n')
  const keyboard = bookingsKeyboard(
    items.map(item => ({ ...item, timeZone: rules.timezone, appUrl: deps.appUrl })),
  )
  await ctx.reply(text, { ...HTML, reply_markup: keyboard })
}

async function showContacts(ctx: Context, deps: BotDeps): Promise<void> {
  await ctx.reply(texts.contacts(deps.appUrl), { ...HTML, link_preview_options: { is_disabled: true } })
}

async function askCancel(ctx: Context, deps: BotDeps, bookingId: string): Promise<void> {
  if (!ctx.from) return
  const own = await findOwnBooking(deps, bookingId, BigInt(ctx.from.id))
  if (own.kind !== 'ok') {
    await ctx.answerCallbackQuery({ text: texts.notYourBooking, show_alert: true })
    return
  }
  const rules = await loadRules(deps.ctx)
  await ctx.answerCallbackQuery()
  await ctx.reply(texts.confirmCancel(own.booking, rules.timezone), {
    ...HTML,
    reply_markup: confirmCancelKeyboard(bookingId),
  })
}

async function confirmCancel(ctx: Context, deps: BotDeps, bookingId: string): Promise<void> {
  if (!ctx.from) return
  const result = await cancelOwnBooking(deps, bookingId, BigInt(ctx.from.id))
  if (result.kind === 'rejected') {
    await ctx.answerCallbackQuery({ text: result.message, show_alert: true })
    return
  }
  const rules = await loadRules(deps.ctx)
  await ctx.answerCallbackQuery({ text: 'Запись отменена' })
  await ctx.editMessageText(texts.cancelledByUser(result.booking, rules.timezone), HTML)
}

/** Кнопки меню, команды /bookings и /contacts, отмена записи из списка. */
export function menuHandlers(deps: BotDeps): Composer<Context> {
  const composer = new Composer<Context>()
  composer.command('bookings', ctx => showBookings(ctx, deps))
  composer.hears(MENU.bookings, ctx => showBookings(ctx, deps))
  composer.command('contacts', ctx => showContacts(ctx, deps))
  composer.hears(MENU.contacts, ctx => showContacts(ctx, deps))
  composer.callbackQuery(CALLBACK_PATTERNS.cancelAsk, ctx => askCancel(ctx, deps, ctx.match[1] ?? ''))
  composer.callbackQuery(CALLBACK_PATTERNS.cancelYes, ctx => confirmCancel(ctx, deps, ctx.match[1] ?? ''))
  composer.callbackQuery(CALLBACK_PATTERNS.cancelNo, async ctx => {
    await ctx.answerCallbackQuery()
    await ctx.editMessageText(texts.cancelKept)
  })
  return composer
}
