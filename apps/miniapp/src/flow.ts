import { type BarberDto, type BookingDto, isValidUzPhone, type SlotDto, toggleId, validateClientName } from '@barber/shared'

import { SLOT_TAKEN_MESSAGE } from './errors'

export const FLOW_STEPS = ['services', 'barber', 'date', 'time', 'contacts', 'confirm', 'success'] as const
export type FlowStep = (typeof FLOW_STEPS)[number]

export const MAX_SERVICES = 5

export type BookingDraft = {
  serviceIds: readonly string[]
  barberId: string | null
  date: string | null
  slot: SlotDto | null
  name: string
  phone: string
}

export type FlowState = {
  step: FlowStep
  draft: BookingDraft
  /** Сообщение для пользователя над текущим шагом (например, «время заняли»). */
  notice: string | null
  /** Растёт, когда слоты нужно загрузить заново. */
  slotsVersion: number
  booking: BookingDto | null
}

export type FlowAction =
  | { type: 'toggleService'; serviceId: string }
  | { type: 'selectBarber'; barberId: string }
  | { type: 'selectDate'; date: string }
  | { type: 'selectSlot'; slot: SlotDto }
  | { type: 'setName'; name: string }
  | { type: 'setPhone'; phone: string }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'booked'; booking: BookingDto }
  /** Сервер отклонил время (SLOT_TAKEN, TOO_SOON…): назад к выбору времени и перезагрузка слотов. */
  | { type: 'slotTaken'; message?: string }
  | { type: 'dismissNotice' }

export function createInitialFlow(prefillName = ''): FlowState {
  return {
    step: 'services',
    draft: { serviceIds: [], barberId: null, date: null, slot: null, name: prefillName, phone: '' },
    notice: null,
    slotsVersion: 0,
    booking: null,
  }
}

/** Можно ли перейти со текущего шага дальше. */
export function canProceed(state: FlowState): boolean {
  const { draft } = state
  switch (state.step) {
    case 'services':
      return draft.serviceIds.length > 0 && draft.serviceIds.length <= MAX_SERVICES
    case 'barber':
      return draft.barberId !== null
    case 'date':
      return draft.date !== null
    case 'time':
      return draft.slot !== null
    case 'contacts':
      return validateClientName(draft.name) === undefined && isValidUzPhone(draft.phone)
    case 'confirm':
    case 'success':
      return false
  }
}

function stepIndex(step: FlowStep): number {
  return FLOW_STEPS.indexOf(step)
}

/** Предыдущий шаг; null — выход из сценария на главный экран. */
export function previousStep(step: FlowStep): FlowStep | null {
  if (step === 'success') return null
  return FLOW_STEPS[stepIndex(step) - 1] ?? null
}

function nextStep(step: FlowStep): FlowStep {
  return FLOW_STEPS[stepIndex(step) + 1] ?? step
}

function updateDraft(state: FlowState, patch: Partial<BookingDraft>): FlowState {
  return { ...state, draft: { ...state.draft, ...patch }, notice: null }
}

function toggleService(state: FlowState, serviceId: string): FlowState {
  const serviceIds = toggleId(state.draft.serviceIds, serviceId)
  if (serviceIds.length > MAX_SERVICES) return state
  // Другой набор услуг — другой список барберов и другие слоты.
  return updateDraft(state, { serviceIds, barberId: null, date: null, slot: null })
}

function selectBarber(state: FlowState, barberId: string): FlowState {
  if (state.draft.barberId === barberId) return state
  return updateDraft(state, { barberId, date: null, slot: null })
}

function selectDate(state: FlowState, date: string): FlowState {
  if (state.draft.date === date) return state
  return updateDraft(state, { date, slot: null })
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'toggleService':
      return toggleService(state, action.serviceId)
    case 'selectBarber':
      return selectBarber(state, action.barberId)
    case 'selectDate':
      return selectDate(state, action.date)
    case 'selectSlot':
      return updateDraft(state, { slot: action.slot })
    case 'setName':
      return updateDraft(state, { name: action.name })
    case 'setPhone':
      return updateDraft(state, { phone: action.phone })
    case 'next':
      return canProceed(state) ? { ...state, step: nextStep(state.step), notice: null } : state
    case 'back': {
      const previous = previousStep(state.step)
      return previous ? { ...state, step: previous, notice: null } : state
    }
    case 'booked':
      return { ...state, step: 'success', booking: action.booking, notice: null }
    case 'slotTaken':
      return {
        ...state,
        step: 'time',
        draft: { ...state.draft, slot: null },
        notice: action.message ?? SLOT_TAKEN_MESSAGE,
        slotsVersion: state.slotsVersion + 1,
      }
    case 'dismissNotice':
      return { ...state, notice: null }
  }
}

/** Номер шага для индикатора «Шаг 2 из 6» (success не считается). */
export function stepNumber(step: FlowStep): { current: number; total: number } {
  const total = FLOW_STEPS.length - 1
  return { current: Math.min(stepIndex(step) + 1, total), total }
}

/** Барберы, которые оказывают все выбранные услуги. */
export function eligibleBarbers(barbers: readonly BarberDto[], serviceIds: readonly string[]): BarberDto[] {
  return barbers.filter(barber => serviceIds.every(id => barber.serviceIds.includes(id)))
}
