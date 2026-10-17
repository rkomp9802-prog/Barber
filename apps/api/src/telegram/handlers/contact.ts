import { Composer, type Context } from 'grammy'
import { telegramDisplayName } from '../../auth/telegram'
import type { BotDeps } from '../deps'
import { acceptContact } from '../confirm-booking'
import { contactRequestKeyboard, mainMenu } from '../keyboards'
import { texts } from '../texts'
import { actorOf } from './start'

/** «Поделиться номером»: подтверждение номера и записей с сайта, которые ждут подтверждения. */
export function contactHandlers(deps: BotDeps): Composer<Context> {
  const composer = new Composer<Context>()
  composer.on('message:contact', async ctx => {
    const actor = actorOf(ctx)
    if (!actor) return
    const { contact } = ctx.message
    const name = telegramDisplayName({
      id: ctx.from.id,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      username: ctx.from.username,
    })
    const result = await acceptContact(deps, actor, { userId: contact.user_id, phoneNumber: contact.phone_number }, name)
    if (result.kind === 'foreign') {
      await ctx.reply(texts.contactForeign, { reply_markup: contactRequestKeyboard() })
      return
    }
    if (result.kind === 'not_uz') {
      await ctx.reply(texts.contactNotUz(deps.appUrl), { reply_markup: mainMenu(deps.miniAppUrl) })
      return
    }
    await ctx.reply(texts.phoneVerified(result.confirmed.length, result.tooMany, result.expired), {
      reply_markup: mainMenu(deps.miniAppUrl),
    })
  })
  return composer
}
