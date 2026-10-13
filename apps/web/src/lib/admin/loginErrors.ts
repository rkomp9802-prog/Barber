import { isApiRequestError } from '../api'
import { errorMessage } from '../apiErrors'

export const INVALID_CREDENTIALS_MESSAGE = 'Неверный логин или пароль.'
export const RATE_LIMITED_LOGIN_MESSAGE = 'Слишком много попыток, подождите и попробуйте снова.'

/** Текст ошибки входа: неверные данные и лимит попыток формулируем отдельно от общих ошибок. */
export function loginErrorMessage(error: unknown): string {
  if (isApiRequestError(error, 'UNAUTHORIZED')) return INVALID_CREDENTIALS_MESSAGE
  if (isApiRequestError(error, 'RATE_LIMITED')) return RATE_LIMITED_LOGIN_MESSAGE
  if (isApiRequestError(error, 'VALIDATION_ERROR')) return 'Проверьте логин и пароль.'
  return errorMessage(error)
}
