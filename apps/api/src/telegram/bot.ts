import { Bot, type BotConfig, type Context, type NextFunction } from 'grammy'
import type { BotDeps } from './deps'
import { menuHandlers } from './handlers/menu'
import { reviewHandlers } from './handlers/reviews'
import { startHandlers } from './handlers/start'
import { mainMenu } from './keyboards'
import { texts } from './texts'

/** Команды бота (setMyCommands в scripts/set-webhook.ts). */
export const BOT_COMMANDS: readonly { readonly command: string; readonly description: string }[] = [
  { command: 'start', description: 'Главное меню' },
  { command: 'bookings', description: 'Мои записи' },
  { command: 'contacts', description: 'Контакты барбершопа' },
]

/** Ошибка в обработчике не должна оставлять пользователя без ответа и ронять webhook. */
function errorBoundary(deps: BotDeps) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    try {
      await next()
    } catch (error: unknown) {
      deps.log.error({ err: error, updateId: ctx.update.update_id }, 'Ошибка обработки Telegram-обновления')
      await notifyFailure(ctx, deps)
    }
  }
}

async function notifyFailure(ctx: Context, deps: BotDeps): Promise<void> {
  try {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: texts.somethingWrong, show_alert: true })
    else if (ctx.chat) await ctx.reply(texts.somethingWrong)
  } catch (error: unknown) {
    deps.log.warn({ err: error }, 'Не удалось сообщить пользователю об ошибке')
  }
}

/** Добавляет обработчики. Бот работает только в личных чатах. */
export function installHandlers(bot: Bot, deps: BotDeps): Bot {
  bot.use(errorBoundary(deps))
  const privateChats = bot.chatType('private')
  privateChats.use(startHandlers(deps))
  privateChats.use(reviewHandlers(deps))
  privateChats.use(menuHandlers(deps))
  privateChats.on('callback_query:data', ctx => ctx.answerCallbackQuery({ text: 'Кнопка устарела' }))
  privateChats.on('message', ctx => ctx.reply('Выберите действие в меню ниже.', { reply_markup: mainMenu(deps.miniAppUrl) }))
  return bot
}

/**
 * Создаёт бота grammY с обработчиками. Обновления приходят через webhook (webhook.ts),
 * поэтому bot.start() (long polling) не вызывается. botInfo можно передать заранее (тесты),
 * иначе webhook вызовет bot.init() (один getMe на холодный старт).
 */
export function createBot(token: string, deps: BotDeps, config: BotConfig<Context> = {}): Bot {
  return installHandlers(new Bot(token, config), deps)
}
