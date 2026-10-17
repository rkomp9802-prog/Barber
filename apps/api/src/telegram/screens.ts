import { GrammyError, type Context, type InlineKeyboard } from 'grammy'
import { listUpcoming } from './client-actions'
import type { BotDeps } from './deps'
import { REMOVE_KEYBOARD, backKeyboard, bookingsKeyboard, emptyBookingsKeyboard, menuKeyboard } from './keyboards'
import { texts } from './texts'

/**
 * Экраны меню бота. В чате живёт одно сообщение-меню: кнопки меняют его содержимое (editMessageText),
 * а новое меню (/start, команда, любое сообщение) удаляет прежнее и сообщение пользователя.
 * Подтверждения записей, напоминания и уведомления — отдельные сообщения, их бот не трогает.
 */
export type Screen = { readonly text: string; readonly keyboard: InlineKeyboard }

const SCREEN_OPTIONS = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } } as const

export function homeScreen(deps: BotDeps, firstName: string): Screen {
  return { text: texts.greeting(firstName), keyboard: menuKeyboard(deps.miniAppUrl) }
}

export function contactsScreen(deps: BotDeps): Screen {
  return { text: texts.contacts(deps.appUrl), keyboard: backKeyboard() }
}

export async function bookingsScreen(deps: BotDeps, telegramId: bigint): Promise<Screen> {
  const { items, rules } = await listUpcoming(deps, telegramId)
  if (items.length === 0) return { text: texts.noUpcoming, keyboard: emptyBookingsKeyboard(deps.miniAppUrl) }
  const body = items.map((item, index) => texts.bookingItem(index + 1, item.booking, rules.timezone)).join('\n\n')
  return {
    text: [texts.upcomingHeader(items.length), '', body, '', texts.cutoffHint(rules.cancelCutoffMin)].join('\n'),
    keyboard: bookingsKeyboard(items.map(item => ({ ...item, timeZone: rules.timezone, appUrl: deps.appUrl }))),
  }
}

/** Удаление «по возможности»: сообщение уже удалено или старше 48 часов — не ошибка для пользователя. */
async function deleteQuietly(ctx: Context, deps: BotDeps, messageId: number): Promise<void> {
  if (!ctx.chat) return
  try {
    await ctx.api.deleteMessage(ctx.chat.id, messageId)
  } catch (error: unknown) {
    deps.log.debug({ err: error }, 'Не удалось удалить сообщение')
  }
}

/** Это сообщение — новое меню чата; прежнее меню удаляем. */
async function rememberMenu(ctx: Context, deps: BotDeps, messageId: number): Promise<void> {
  if (!ctx.chat) return
  const previous = await deps.repo.swapMenuMessage(BigInt(ctx.chat.id), messageId)
  if (previous !== null) await deleteQuietly(ctx, deps, previous)
}

/**
 * Старое меню было reply-клавиатурой и висит внизу у тех, кто писал боту раньше. Убрать её можно только
 * сообщением с remove_keyboard: отправляем служебное сообщение и сразу удаляем его.
 */
async function removeLegacyKeyboard(ctx: Context, deps: BotDeps): Promise<void> {
  const notice = await ctx.reply('Обновляем меню…', { reply_markup: REMOVE_KEYBOARD })
  await deleteQuietly(ctx, deps, notice.message_id)
}

export type SendScreenOptions = {
  /** Убрать reply-клавиатуру (старое меню или «Поделиться номером»). */
  readonly removeKeyboard?: boolean
}

/** Новое меню внизу чата: сообщение пользователя и прежнее меню удаляются. */
export async function sendScreen(
  ctx: Context,
  deps: BotDeps,
  screen: Screen,
  options: SendScreenOptions = {},
): Promise<void> {
  if (ctx.message) await deleteQuietly(ctx, deps, ctx.message.message_id)
  if (options.removeKeyboard) await removeLegacyKeyboard(ctx, deps)
  const sent = await ctx.reply(screen.text, { ...SCREEN_OPTIONS, reply_markup: screen.keyboard })
  await rememberMenu(ctx, deps, sent.message_id)
}

/** «message is not modified»: пользователь нажал кнопку того же экрана — менять нечего. */
function isNotModified(error: unknown): boolean {
  return error instanceof GrammyError && error.description.includes('message is not modified')
}

/** Кнопка меню: тот же экран-сообщение меняет содержимое. */
export async function editScreen(ctx: Context, deps: BotDeps, screen: Screen): Promise<void> {
  await ctx.answerCallbackQuery()
  try {
    await ctx.editMessageText(screen.text, { ...SCREEN_OPTIONS, reply_markup: screen.keyboard })
  } catch (error: unknown) {
    if (!isNotModified(error)) throw error
  }
  const messageId = ctx.callbackQuery?.message?.message_id
  if (messageId !== undefined) await rememberMenu(ctx, deps, messageId)
}
