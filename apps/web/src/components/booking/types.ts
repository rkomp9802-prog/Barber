import type { BarberChoice, BarberDto, BookingDto, ServiceDto, SlotTime } from '@barber/shared'

/** Шаги мастера записи в порядке прохождения (spec §13). */
export const STEPS = ['service', 'barber', 'date', 'time', 'contacts', 'confirm'] as const
export type StepId = (typeof STEPS)[number]

export const STEP_LABELS: Record<StepId, string> = {
  service: 'Услуга',
  barber: 'Барбер',
  date: 'Дата',
  time: 'Время',
  contacts: 'Контакты',
  confirm: 'Подтверждение',
}

/** Каталог, с которым работает мастер: из API или демо-данные. */
export type BookingCatalog = {
  services: readonly ServiceDto[]
  barbers: readonly BarberDto[]
}

/** Выбранный слот: время для показа и точное начало в UTC для API. */
export type SelectedSlot = {
  time: SlotTime
  startsAt: string
}

/** Слот из списка свободного времени (как SlotDto из API). */
export type SlotOption = SelectedSlot & {
  barberIds: readonly string[]
}

export type DayOption = {
  date: string
  hasSlots: boolean
}

/** Всё, что нужно для создания записи (POST /api/v1/bookings). */
export type BookingDraft = {
  serviceIds: string[]
  barber: BarberChoice
  dateKey: string
  slot: SelectedSlot
  name: string
  phone: string
}

export type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; booking: BookingDto }
