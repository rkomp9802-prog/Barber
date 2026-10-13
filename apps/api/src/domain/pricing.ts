import type { BookingServiceDto } from '@barber/shared'

/** Услуга из каталога. */
export type CatalogService = {
  readonly id: string
  readonly name: string
  readonly durationMin: number
  readonly price: number
  readonly isActive: boolean
}

/** Связь барбер ↔ услуга с необязательным переопределением цены и длительности. */
export type BarberServiceLink = {
  readonly barberId: string
  readonly serviceId: string
  readonly durationMin: number | null
  readonly price: number | null
  readonly isEnabled: boolean
}

/** Итог по выбранным услугам у конкретного барбера. */
export type Quote = {
  readonly barberId: string
  readonly totalDurationMin: number
  readonly totalPrice: number
  readonly items: readonly BookingServiceDto[]
}

/** Убирает повторы, сохраняя порядок выбора. */
export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

/**
 * Считает длительность и цену для барбера. Возвращает null, если барбер
 * не оказывает хотя бы одну из услуг или услуга выключена.
 */
export function quoteForBarber(
  barberId: string,
  services: readonly CatalogService[],
  links: readonly BarberServiceLink[],
): Quote | null {
  if (services.length === 0) return null
  const items: BookingServiceDto[] = []
  for (const service of services) {
    const link = links.find(l => l.barberId === barberId && l.serviceId === service.id)
    if (!service.isActive || !link || !link.isEnabled) return null
    items.push({
      serviceId: service.id,
      name: service.name,
      durationMin: link.durationMin ?? service.durationMin,
      price: link.price ?? service.price,
    })
  }
  return {
    barberId,
    totalDurationMin: items.reduce((sum, item) => sum + item.durationMin, 0),
    totalPrice: items.reduce((sum, item) => sum + item.price, 0),
    items,
  }
}
