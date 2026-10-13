import type { Service } from './types'

export function selectedServices(all: readonly Service[], ids: readonly string[]): Service[] {
  return all.filter(service => ids.includes(service.id))
}

export function totalDurationMin(services: readonly Service[]): number {
  return services.reduce((sum, service) => sum + service.durationMin, 0)
}

export function totalPrice(services: readonly Service[]): number {
  return services.reduce((sum, service) => sum + service.price, 0)
}

/** Добавляет услугу, если её нет, и убирает, если есть. Исходный массив не меняется. */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(existing => existing !== id) : [...ids, id]
}

const MIN_NAME_LENGTH = 2
const MAX_NAME_LENGTH = 60

export function validateClientName(name: string): string | undefined {
  const trimmed = name.trim()
  if (trimmed.length < MIN_NAME_LENGTH) return 'Введите имя — минимум 2 буквы'
  if (trimmed.length > MAX_NAME_LENGTH) return 'Слишком длинное имя'
  return undefined
}
