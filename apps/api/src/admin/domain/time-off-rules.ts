import type { TimeOffType } from '@barber/shared'

export type TimeOffFields = {
  readonly barberId: string | null
  readonly startsAt: Date
  readonly endsAt: Date
  readonly type: TimeOffType
}

/**
 * Проверка исключения. Возвращает текст ошибки или null.
 * shop_closed относится ко всему салону, поэтому barberId обязан быть null.
 */
export function timeOffProblem(fields: TimeOffFields): string | null {
  if (fields.startsAt.getTime() >= fields.endsAt.getTime()) return 'Начало исключения должно быть раньше конца'
  if (fields.type === 'shop_closed' && fields.barberId !== null) {
    return 'Закрытие барбершопа не привязывается к барберу: укажите barberId = null'
  }
  return null
}
