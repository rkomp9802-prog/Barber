/** Услуга барбершопа. Цена в сумах, длительность в минутах. */
export type Service = {
  id: string
  name: string
  description: string
  durationMin: number
  price: number
}

export type Barber = {
  id: string
  name: string
  role: string
  bio: string
  experienceYears: number
  rating: number
  reviewsCount: number
  serviceIds: string[]
}

export type Review = {
  id: string
  clientName: string
  barberId: string
  rating: number
  comment: string
  /** Дата визита в формате YYYY-MM-DD (по Ташкенту). */
  date: string
}

/** Выбор «Любой свободный» вместо конкретного барбера. */
export const ANY_BARBER = 'any'
export type BarberChoice = string | typeof ANY_BARBER

/** Время слота в формате HH:MM по Ташкенту. */
export type SlotTime = string
