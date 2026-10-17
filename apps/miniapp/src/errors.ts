import { DEFAULT_SETTINGS, MAX_ACTIVE_BOOKINGS_PER_PHONE, plural } from '@barber/shared'

import { ApiRequestError, type RequestErrorCode } from './api'

const CUTOFF_MIN = DEFAULT_SETTINGS.cancel_cutoff_min

/** Подсказка у неактивных кнопок «Отменить/Перенести». */
export const CUTOFF_HINT = `Изменить можно не позже чем за ${CUTOFF_MIN} ${plural(CUTOFF_MIN, ['минуту', 'минуты', 'минут'])} до начала`

export const SLOT_TAKEN_MESSAGE = 'Это время только что заняли. Выберите другое.'

const MESSAGES: Readonly<Record<RequestErrorCode, string>> = {
  SLOT_TAKEN: SLOT_TAKEN_MESSAGE,
  CUTOFF_PASSED: CUTOFF_HINT,
  TOO_SOON: 'До этого времени осталось слишком мало — выберите время попозже.',
  TOO_FAR: 'На такую дату запись ещё не открыта.',
  OUTSIDE_WORKING_HOURS: 'В это время барбершоп не работает. Выберите другое время.',
  SERVICE_UNAVAILABLE: 'Этот барбер не оказывает одну из выбранных услуг.',
  BOOKING_NOT_ACTIVE: 'Запись уже отменена или завершена.',
  TOO_MANY_BOOKINGS: `У вас уже ${MAX_ACTIVE_BOOKINGS_PER_PHONE} предстоящие записи. Отмените одну из них в «Мои записи».`,
  NOT_FOUND: 'Не удалось найти запись или услугу. Обновите список.',
  VALIDATION_ERROR: 'Проверьте введённые данные и попробуйте ещё раз.',
  UNAUTHORIZED: 'Не удалось подтвердить вход через Telegram. Закройте и снова откройте приложение из бота.',
  RATE_LIMITED: 'Слишком много запросов. Подождите минуту и попробуйте снова.',
  FORBIDDEN: 'Это действие недоступно.',
  NOT_CONFIGURED: 'Эта функция пока не настроена. Попробуйте позже.',
  INTERNAL: 'На сервере что-то пошло не так. Попробуйте ещё раз чуть позже.',
  NETWORK_ERROR: 'Нет связи с сервером. Проверьте интернет и попробуйте снова.',
  UNKNOWN: 'Что-то пошло не так. Попробуйте ещё раз.',
}

/** Понятное пользователю сообщение для любой ошибки запроса. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return MESSAGES[error.code]
  return MESSAGES.UNKNOWN
}

export function errorCode(error: unknown): RequestErrorCode {
  return error instanceof ApiRequestError ? error.code : 'UNKNOWN'
}
