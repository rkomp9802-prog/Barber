import { MAX_ACTIVE_BOOKINGS_PER_PHONE } from '@barber/shared'

import { isApiRequestError, type ApiRequestErrorCode } from './api'

/** Понятные клиенту тексты ошибок. Сообщение сервера — запасной вариант. */
export const ERROR_MESSAGES: Readonly<Partial<Record<ApiRequestErrorCode, string>>> = {
  NETWORK_ERROR: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.',
  SLOT_TAKEN: 'Это время только что заняли. Выберите другое.',
  TOO_SOON: 'До этого времени осталось слишком мало. Выберите время попозже.',
  TOO_FAR: 'На эту дату запись ещё не открыта. Выберите дату ближе.',
  OUTSIDE_WORKING_HOURS: 'В это время мастер не работает. Выберите другое время.',
  SERVICE_UNAVAILABLE: 'Мастер больше не оказывает одну из услуг. Выберите другого мастера.',
  VALIDATION_ERROR: 'Проверьте имя и номер телефона.',
  CUTOFF_PASSED: 'Изменить запись уже нельзя: до визита осталось слишком мало времени.',
  BOOKING_NOT_ACTIVE: 'Запись уже отменена или завершена.',
  TOO_MANY_BOOKINGS: `На этот номер уже есть ${MAX_ACTIVE_BOOKINGS_PER_PHONE} предстоящие записи. Отмените одну из них или позвоните нам.`,
  NOT_FOUND: 'Запись не найдена. Проверьте ссылку.',
  RATE_LIMITED: 'Слишком много попыток. Подождите минуту и попробуйте снова.',
  UNAUTHORIZED: 'Сессия истекла. Войдите снова.',
  NOT_CONFIGURED: 'Эта функция пока не настроена на сервере.',
  INTERNAL: 'На сервере что-то пошло не так. Попробуйте ещё раз.',
}

export const UNKNOWN_ERROR_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз.'

export function errorMessage(error: unknown): string {
  if (isApiRequestError(error)) return ERROR_MESSAGES[error.code] ?? error.message
  if (error instanceof Error && error.message) return error.message
  return UNKNOWN_ERROR_MESSAGE
}

/** Куда вернуть клиента в мастере записи, чтобы он мог исправить проблему. */
export type SubmitRecoveryStep = 'barber' | 'date' | 'time' | 'contacts' | 'confirm'

export type SubmitErrorInfo = {
  message: string
  step: SubmitRecoveryStep
}

const RECOVERY_STEPS: Readonly<Partial<Record<ApiRequestErrorCode, SubmitRecoveryStep>>> = {
  SLOT_TAKEN: 'time',
  TOO_SOON: 'time',
  OUTSIDE_WORKING_HOURS: 'time',
  TOO_FAR: 'date',
  SERVICE_UNAVAILABLE: 'barber',
  VALIDATION_ERROR: 'contacts',
}

/** Ошибка POST /bookings → сообщение и шаг, на который нужно вернуться. */
export function describeSubmitError(error: unknown): SubmitErrorInfo {
  const step = isApiRequestError(error) ? (RECOVERY_STEPS[error.code] ?? 'confirm') : 'confirm'
  return { message: errorMessage(error), step }
}
