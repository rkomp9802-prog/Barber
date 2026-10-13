import type { DaysState } from './useAvailability'

/**
 * Можно ли нажать день на шаге даты.
 * - Пока грузятся свободные дни — нельзя: иначе клиент выберет день, где мест уже нет.
 * - Загрузка упала с ошибкой — можно (осознанный fallback: сервер всё равно проверит при записи).
 * - Загружено — только дни с hasSlots. День, которого нет в ответе, считается доступным (как раньше).
 */
export function dayAvailability(state: DaysState, day: string): boolean {
  if (state.status === 'loading') return false
  if (state.status === 'error') return true
  return state.data.find(item => item.date === day)?.hasSlots ?? true
}
