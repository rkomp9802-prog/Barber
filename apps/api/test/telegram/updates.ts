import type { Message, MessageEntity, Update } from 'grammy/types'
import { NOW } from '../fixtures/calendar'
import { BOT_ID, BOT_USERNAME, TG_USER_ID } from './harness'

/** Сообщение, на которое ответили (без вложенного reply_to_message). */
type ReplyTo = NonNullable<Message['reply_to_message']>

const NOW_SEC = Math.floor(NOW / 1000)
const FIRST_NAME = 'Азиз'

let updateCounter = 1
const nextId = (): number => {
  updateCounter += 1
  return updateCounter
}

/** Личный чат пользователя; chat.id совпадает с from.id, как в Telegram. */
function privateChat(fromId: number): { id: number; type: 'private'; first_name: string } {
  return { id: fromId, type: 'private', first_name: FIRST_NAME }
}

function userFrom(fromId: number): { id: number; is_bot: false; first_name: string } {
  return { id: fromId, is_bot: false, first_name: FIRST_NAME }
}

/** Сообщение пользователя боту. entities нужны, чтобы /start распознался как команда. */
export function textUpdate(
  text: string,
  options: { fromId?: number; entities?: MessageEntity[]; replyTo?: ReplyTo } = {},
): Update {
  const fromId = options.fromId ?? TG_USER_ID
  const messageId = nextId()
  return {
    update_id: messageId,
    message: {
      message_id: messageId,
      date: NOW_SEC,
      chat: privateChat(fromId),
      from: userFrom(fromId),
      text,
      entities: options.entities,
      reply_to_message: options.replyTo,
    },
  }
}

/** Контакт, отправленный кнопкой «Поделиться номером» (или пересланный чужой — userId другого человека). */
export function contactUpdate(
  phoneNumber: string,
  options: { fromId?: number; userId?: number | null; forwarded?: boolean } = {},
): Update {
  const fromId = options.fromId ?? TG_USER_ID
  const messageId = nextId()
  const userId = options.userId === undefined ? fromId : options.userId
  return {
    update_id: messageId,
    message: {
      message_id: messageId,
      date: NOW_SEC,
      chat: privateChat(fromId),
      from: userFrom(fromId),
      contact: { phone_number: phoneNumber, first_name: FIRST_NAME, ...(userId === null ? {} : { user_id: userId }) },
      ...(options.forwarded ? { forward_origin: { type: 'user' as const, date: NOW_SEC, sender_user: userFrom(fromId) } } : {}),
    },
  }
}

/** /start с необязательным payload (deep link). */
export function startUpdate(payload: string | undefined, fromId = TG_USER_ID): Update {
  const text = payload ? `/start ${payload}` : '/start'
  return textUpdate(text, { fromId, entities: [{ type: 'bot_command', offset: 0, length: 6 }] })
}

/** Нажатие inline-кнопки под сообщением бота. */
export function callbackUpdate(data: string, fromId = TG_USER_ID): Update {
  const updateId = nextId()
  const botMessage: Message = {
    message_id: updateId,
    date: NOW_SEC,
    chat: privateChat(fromId),
    from: { id: BOT_ID, is_bot: true, first_name: 'Sharp', username: BOT_USERNAME },
    text: 'Оцените визит',
  }
  return {
    update_id: updateId,
    callback_query: {
      id: `cb-${updateId}`,
      from: userFrom(fromId),
      chat_instance: 'test-chat-instance',
      data,
      message: botMessage,
    },
  }
}

/** Сообщение бота, на которое пользователь ответил (вопрос о комментарии с ссылкой-маркером). */
export function botPromptWithMarker(bookingId: string): ReplyTo {
  const url = `https://t.me/${BOT_USERNAME}?start=rv_${bookingId}`
  const text = 'Хотите добавить комментарий к отзыву?'
  return {
    message_id: 77,
    date: NOW_SEC,
    chat: privateChat(TG_USER_ID),
    from: { id: BOT_ID, is_bot: true, first_name: 'Sharp', username: BOT_USERNAME },
    reply_to_message: undefined,
    text,
    entities: [{ type: 'text_link', offset: text.indexOf('отзыву'), length: 'отзыву'.length, url }],
  }
}
