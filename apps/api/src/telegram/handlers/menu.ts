import { Composer, type Context } from 'grammy'
import { loadRules } from '../../services/context'
import { cancelOwnBooking, findOwnBooking } from '../client-actions'
import type { BotDeps } from '../deps'
import { CALLBACK, CALLBACK_PATTERNS, MENU, afterCancelKeyboard, confirmCancelKeyboard } from '../keyboards'
import { bookingsScreen, contactsScreen, editScreen, homeScreen, sendScreen } from '../screens'
import { texts } from '../texts'

const firstName = (ctx: Context): string => ctx.from?.first_name ?? ''

async function askCancel(ctx: Context, deps: BotDeps, bookingId: string): Promise<void> {
  if (!ctx.from) return
  const own = await findOwnBooking(deps, bookingId, BigInt(ctx.from.id))
  if (own.kind !== 'ok') {
    await ctx.answerCallbackQuery({ text: texts.notYourBooking, show_alert: true })
    return
  }
  const rules = await loadRules(deps.ctx)
  await editScreen(ctx, deps, { text: texts.confirmCancel(own.booking, rules.timezone), keyboard: confirmCancelKeyboard(bookingId) })
}

async function confirmCancel(ctx: Context, deps: BotDeps, bookingId: string): Promise<void> {
  if (!ctx.from) return
  const result = await cancelOwnBooking(deps, bookingId, BigInt(ctx.from.id))
  if (result.kind === 'rejected') {
    await ctx.answerCallbackQuery({ text: result.message, show_alert: true })
    return
  }
  const rules = await loadRules(deps.ctx)
  await editScreen(ctx, deps, { text: texts.cancelledByUser(result.booking, rules.timezone), keyboard: afterCancelKeyboard() })
}

/**
 * Меню бота: экраны «Главное», «Мои записи», «Контакты» и отмена записи — в одном сообщении.
 * Команды /bookings и /contacts и тексты старой reply-клавиатуры открывают экран новым сообщением.
 */
export function menuHandlers(deps: BotDeps): Composer<Context> {
  const composer = new Composer<Context>()
  const bookings = async (ctx: Context) => (ctx.from ? bookingsScreen(deps, BigInt(ctx.from.id)) : null)

  composer.command('bookings', async ctx => {
    const screen = await bookings(ctx)
    if (screen) await sendScreen(ctx, deps, screen)
  })
  composer.command('contacts', ctx => sendScreen(ctx, deps, contactsScreen(deps)))
  // Кнопки старой reply-клавиатуры: показываем экран и убираем саму клавиатуру.
  composer.hears(MENU.bookings, async ctx => {
    const screen = await bookings(ctx)
    if (screen) await sendScreen(ctx, deps, screen, { removeKeyboard: true })
  })
  composer.hears(MENU.contacts, ctx => sendScreen(ctx, deps, contactsScreen(deps), { removeKeyboard: true }))
  composer.hears(MENU.book, ctx => sendScreen(ctx, deps, homeScreen(deps, firstName(ctx)), { removeKeyboard: true }))

  composer.callbackQuery(CALLBACK.home, ctx => editScreen(ctx, deps, homeScreen(deps, firstName(ctx))))
  composer.callbackQuery(CALLBACK.contacts, ctx => editScreen(ctx, deps, contactsScreen(deps)))
  composer.callbackQuery([CALLBACK.bookings, CALLBACK.cancelNo], async ctx => {
    const screen = await bookings(ctx)
    if (screen) await editScreen(ctx, deps, screen)
  })
  composer.callbackQuery(CALLBACK_PATTERNS.cancelAsk, ctx => askCancel(ctx, deps, ctx.match[1] ?? ''))
  composer.callbackQuery(CALLBACK_PATTERNS.cancelYes, ctx => confirmCancel(ctx, deps, ctx.match[1] ?? ''))
  return composer
}
