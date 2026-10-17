import { Composer, type Context } from 'grammy'
import { telegramDisplayName } from '../../auth/telegram'
import type { BotDeps } from '../deps'
import { acceptContact } from '../confirm-booking'
import { REMOVE_KEYBOARD, contactRequestKeyboard } from '../keyboards'
import { homeScreen, sendScreen } from '../screens'
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
    // Пересланное сообщение с контактом — не «Поделиться номером»: не принимаем, даже если контакт свой.
    const userId = ctx.message.forward_origin ? undefined : contact.user_id
    const result = await acceptContact(deps, actor, { userId, phoneNumber: contact.phone_number }, name)
    if (result.kind === 'foreign') {
      await ctx.reply(texts.contactForeign, { reply_markup: contactRequestKeyboard() })
      return
    }
    const text =
      result.kind === 'not_uz'
        ? texts.contactNotUz(deps.appUrl)
        : texts.phoneVerified(result.confirmed.length, result.tooMany, result.expired)
    // Ответ остаётся в чате и убирает кнопку «Поделиться номером»; сообщение с номером удаляется, ниже — меню.
    await ctx.reply(text, { reply_markup: REMOVE_KEYBOARD })
    await sendScreen(ctx, deps, homeScreen(deps, ctx.from.first_name))
  })
  return composer
}
