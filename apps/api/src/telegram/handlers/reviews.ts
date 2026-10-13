import { Composer, type Context } from 'grammy'
import type { MessageEntity } from 'grammy/types'
import { rateBooking, REVIEW_COMMENT_MAX, saveComment, type CommentResult, type RateResult } from '../client-actions'
import type { BotDeps } from '../deps'
import { CALLBACK_PATTERNS } from '../keyboards'
import { texts } from '../texts'

/**
 * Отзыв в два шага без серверного состояния (подходит для Vercel serverless):
 *
 * 1. Edge Function присылает «Оцените визит» с кнопками rate:<bookingId>:<1-5>.
 *    Нажатие → проверяем, что нажал клиент этой записи, визит завершён и отзыва нет,
 *    создаём отзыв (is_public = rating >= review_public_min_rating, комментарий пустой).
 * 2. Бот отправляет вопрос о комментарии с force_reply. В текст вшита ссылка
 *    https://t.me/<bot>?start=rv_<bookingId> (слово «отзыву»): так id записи едет вместе с сообщением.
 *    Когда клиент отвечает на этот вопрос, Telegram присылает reply_to_message с entities —
 *    бот берёт id из ссылки, убеждается, что исходное сообщение отправил он сам, и снова проверяет,
 *    что пишет клиент записи. Комментарий сохраняется один раз (UPDATE ... WHERE comment IS NULL).
 * Никакой памяти между запросами не нужно: всё нужное лежит в самом сообщении и в базе.
 */

export const REVIEW_START_PREFIX = 'rv_'
const MARKER_PATTERN = /[?&]start=rv_([0-9a-f-]{36})$/

export function reviewMarkerUrl(botUsername: string, bookingId: string): string {
  return `https://t.me/${botUsername}?start=${REVIEW_START_PREFIX}${bookingId}`
}

/** id записи из ссылки-маркера в сообщении бота. */
export function bookingIdFromMarker(entities: readonly MessageEntity[] | undefined): string | null {
  for (const entity of entities ?? []) {
    if (entity.type !== 'text_link') continue
    const match = MARKER_PATTERN.exec(entity.url)
    if (match?.[1]) return match[1]
  }
  return null
}

const RATE_ALERTS: Readonly<Record<Exclude<RateResult, 'rated'>, string>> = {
  not_found: texts.bookingNotFound,
  forbidden: texts.notYourBooking,
  not_completed: texts.reviewNotReady,
  already: texts.reviewAlreadyLeft,
}

const COMMENT_REPLIES: Readonly<Record<CommentResult, string>> = {
  saved: texts.commentSaved,
  not_found: texts.bookingNotFound,
  forbidden: texts.notYourBooking,
  already: texts.commentAlreadySet,
  too_long: texts.commentTooLong(REVIEW_COMMENT_MAX),
  empty: texts.commentHowTo,
}

/** Убирает кнопки оценки у старого сообщения; ошибка (сообщение слишком старое) не критична. */
async function replaceRatingMessage(ctx: Context, deps: BotDeps, text: string): Promise<void> {
  try {
    await ctx.editMessageText(text)
  } catch (error: unknown) {
    deps.log.warn({ err: error }, 'Не удалось изменить сообщение с оценкой')
  }
}

async function onRate(ctx: Context, deps: BotDeps, bookingId: string, rating: number): Promise<void> {
  if (!ctx.from) return
  const result = await rateBooking(deps, bookingId, BigInt(ctx.from.id), rating)
  if (result !== 'rated') {
    await ctx.answerCallbackQuery({ text: RATE_ALERTS[result], show_alert: true })
    if (result === 'already') await replaceRatingMessage(ctx, deps, texts.reviewAlreadyLeft)
    return
  }
  await ctx.answerCallbackQuery({ text: 'Спасибо!' })
  await replaceRatingMessage(ctx, deps, texts.ratingThanks(rating))
  await ctx.reply(texts.commentPrompt(reviewMarkerUrl(ctx.me.username, bookingId)), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: { force_reply: true, input_field_placeholder: 'Ваш комментарий' },
  })
}

export function reviewHandlers(deps: BotDeps): Composer<Context> {
  const composer = new Composer<Context>()
  composer.callbackQuery(CALLBACK_PATTERNS.rate, async ctx => {
    const [, bookingId = '', rating = '0'] = ctx.match
    await onRate(ctx, deps, bookingId, Number(rating))
  })
  composer.on('message:text', async (ctx, next) => {
    const replied = ctx.message.reply_to_message
    const bookingId = replied?.from?.id === ctx.me.id ? bookingIdFromMarker(replied.entities) : null
    if (!bookingId) return next()
    const result = await saveComment(deps, bookingId, BigInt(ctx.from.id), ctx.message.text)
    await ctx.reply(COMMENT_REPLIES[result])
  })
  return composer
}
