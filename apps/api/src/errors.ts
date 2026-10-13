import type { ApiError, ApiErrorCode } from '@barber/shared'
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

/** HTTP-статус для каждого кода ошибки контракта API. */
export const ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  SLOT_TAKEN: 409,
  OUTSIDE_WORKING_HOURS: 422,
  TOO_SOON: 422,
  TOO_FAR: 422,
  SERVICE_UNAVAILABLE: 422,
  CUTOFF_PASSED: 422,
  BOOKING_NOT_ACTIVE: 409,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  FORBIDDEN: 403,
  NOT_CONFIGURED: 503,
  INTERNAL: 500,
}

/** Сообщения по умолчанию (показываются пользователю). */
export const DEFAULT_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR: 'Проверьте введённые данные',
  NOT_FOUND: 'Не найдено',
  SLOT_TAKEN: 'Это время уже заняли. Выберите другое',
  OUTSIDE_WORKING_HOURS: 'В это время барбер не работает',
  TOO_SOON: 'Слишком близко к текущему времени. Выберите время позже',
  TOO_FAR: 'На эту дату запись ещё не открыта',
  SERVICE_UNAVAILABLE: 'Услуга недоступна у выбранного барбера',
  CUTOFF_PASSED: 'Изменить запись уже нельзя: до визита осталось слишком мало времени',
  BOOKING_NOT_ACTIVE: 'Запись уже отменена или завершена',
  UNAUTHORIZED: 'Требуется авторизация',
  RATE_LIMITED: 'Слишком много запросов. Попробуйте через минуту',
  FORBIDDEN: 'Доступ запрещён',
  NOT_CONFIGURED: 'Функция не настроена на сервере',
  INTERNAL: 'Что-то пошло не так. Попробуйте ещё раз',
}

/** Ожидаемая ошибка бизнес-логики с кодом из контракта. */
export class AppError extends Error {
  readonly code: ApiErrorCode
  readonly statusCode: number
  readonly details?: unknown

  constructor(code: ApiErrorCode, message?: string, details?: unknown) {
    super(message ?? DEFAULT_MESSAGES[code])
    this.name = 'AppError'
    this.code = code
    this.statusCode = ERROR_STATUS[code]
    this.details = details
  }
}

const EXCLUSION_VIOLATION = '23P01'
const MAX_DEPTH = 6

/**
 * Нарушение exclusion constraint bookings_no_overlap (PostgreSQL 23P01).
 * Prisma с driver adapter кладёт код глубоко (meta.driverAdapterError.cause.originalCode),
 * поэтому ищем его по всему графу ошибки.
 */
export function isExclusionViolation(error: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH || error === null || typeof error !== 'object') return false
  const record = error as Record<string, unknown>
  if (record.code === EXCLUSION_VIOLATION || record.originalCode === EXCLUSION_VIOLATION) return true
  if (typeof record.message === 'string' && record.message.includes('bookings_no_overlap')) return true
  return ['cause', 'meta', 'driverAdapterError', 'error'].some(key => isExclusionViolation(record[key], depth + 1))
}

/** Нарушение уникального индекса (Prisma P2002 или PostgreSQL 23505). */
export function isUniqueViolation(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false
  const record = error as Record<string, unknown>
  return record.code === 'P2002' || record.code === '23505'
}

function zodDetails(error: ZodError): { path: string; message: string }[] {
  return error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
}

/** Любая ошибка → AppError с безопасным для клиента сообщением. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof ZodError) return new AppError('VALIDATION_ERROR', undefined, zodDetails(error))
  if (isExclusionViolation(error)) return new AppError('SLOT_TAKEN')
  const statusCode = (error as Partial<FastifyError> | null)?.statusCode
  if (statusCode === 404) return new AppError('NOT_FOUND')
  if (statusCode === 429) return new AppError('RATE_LIMITED')
  if (statusCode === 401) return new AppError('UNAUTHORIZED')
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    return Object.assign(new AppError('VALIDATION_ERROR', 'Некорректный запрос'), { statusCode: 400 })
  }
  return new AppError('INTERNAL')
}

function sendError(reply: FastifyReply, appError: AppError): FastifyReply {
  const body: ApiError = { code: appError.code, message: appError.message }
  const withDetails = appError.details === undefined ? body : { ...body, details: appError.details }
  return reply.status(appError.statusCode).send(withDetails)
}

/** Подключает единый формат ошибок { code, message, details? } для всего приложения. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const appError = toAppError(error)
    if (appError.code === 'INTERNAL') {
      request.log.error({ err: error }, 'Необработанная ошибка')
    } else {
      request.log.info({ code: appError.code }, 'Ошибка запроса')
    }
    return sendError(reply, appError)
  })
  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) =>
    sendError(reply, new AppError('NOT_FOUND', 'Маршрут не найден')),
  )
}
