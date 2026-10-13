import {
  ANY_BARBER,
  formatUzPhone,
  isValidUzPhone,
  toggleId,
  uzLocalDigits,
  validateClientName,
  type Barber,
  type BarberChoice,
  type BookingDto,
} from '@barber/shared'

import {
  STEPS,
  type BookingCatalog,
  type BookingDraft,
  type SelectedSlot,
  type StepId,
  type SubmitState,
} from './types'

export type BookingState = {
  catalog: BookingCatalog
  step: StepId
  serviceIds: string[]
  barber: BarberChoice | null
  dateKey: string | null
  slot: SelectedSlot | null
  name: string
  phone: string
  submit: SubmitState
}

export type BookingAction =
  | { type: 'toggleService'; id: string }
  | { type: 'selectBarber'; barber: BarberChoice }
  | { type: 'selectDate'; dateKey: string }
  | { type: 'selectSlot'; slot: SelectedSlot }
  | { type: 'setName'; name: string }
  | { type: 'setPhone'; phone: string }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goTo'; step: StepId }
  | { type: 'submitStart' }
  | { type: 'submitSuccess'; booking: BookingDto }
  /** step — куда вернуть клиента, чтобы исправить проблему (занятое время → шаг «Время»). */
  | { type: 'submitFailure'; message: string; step?: StepId }
  | { type: 'reset' }

export type InitialSelection = {
  serviceId?: string
  barber?: BarberChoice
}

export type InitArgs = {
  catalog: BookingCatalog
  selection?: InitialSelection
}

/** Барберы, которые умеют делать ВСЕ выбранные услуги. */
export function qualifyingBarbers<T extends Barber>(barbers: readonly T[], serviceIds: readonly string[]): T[] {
  if (serviceIds.length === 0) return []
  return barbers.filter(barber => serviceIds.every(id => barber.serviceIds.includes(id)))
}

function isBarberValid(catalog: BookingCatalog, barber: BarberChoice | null, serviceIds: readonly string[]): boolean {
  if (barber === null) return false
  const qualifying = qualifyingBarbers(catalog.barbers, serviceIds)
  if (barber === ANY_BARBER) return qualifying.length > 0
  return qualifying.some(candidate => candidate.id === barber)
}

export function isContactsValid(state: Pick<BookingState, 'name' | 'phone'>): boolean {
  return validateClientName(state.name) === undefined && isValidUzPhone(state.phone)
}

export function isStepValid(state: BookingState, step: StepId): boolean {
  switch (step) {
    case 'service':
      return state.serviceIds.length > 0
    case 'barber':
      return isBarberValid(state.catalog, state.barber, state.serviceIds)
    case 'date':
      return state.dateKey !== null
    case 'time':
      return state.slot !== null
    case 'contacts':
      return isContactsValid(state)
    case 'confirm':
      return toDraft(state) !== undefined
  }
}

export function stepIndex(step: StepId): number {
  return STEPS.indexOf(step)
}

/** Самый дальний шаг, куда можно попасть: все шаги до него заполнены. */
export function maxReachableIndex(state: BookingState): number {
  const firstInvalid = STEPS.findIndex(step => !isStepValid(state, step))
  return firstInvalid === -1 ? STEPS.length - 1 : firstInvalid
}

export function toDraft(state: BookingState): BookingDraft | undefined {
  const { serviceIds, barber, dateKey, slot, name, phone } = state
  if (serviceIds.length === 0 || barber === null || dateKey === null || slot === null) return undefined
  if (!isBarberValid(state.catalog, barber, serviceIds) || !isContactsValid(state)) return undefined
  return { serviceIds, barber, dateKey, slot, name: name.trim(), phone }
}

const EMPTY_FIELDS = {
  step: 'service',
  serviceIds: [],
  barber: null,
  dateKey: null,
  slot: null,
  name: '',
  phone: '',
  submit: { kind: 'idle' },
} as const satisfies Omit<BookingState, 'catalog'>

/** Начальное состояние по параметрам ссылки (/book?service=…&barber=…). Значения уже проверены. */
export function createInitialState({ catalog, selection = {} }: InitArgs): BookingState {
  const serviceIds = selection.serviceId ? [selection.serviceId] : []
  const requested = selection.barber ?? null
  // Барбер из ссылки не делает выбранную услугу — не подставляем его молча.
  const barber = serviceIds.length > 0 && !isBarberValid(catalog, requested, serviceIds) ? null : requested
  const base: BookingState = { ...EMPTY_FIELDS, catalog, serviceIds, barber }
  const reachable = STEPS[Math.min(maxReachableIndex(base), stepIndex('date'))] ?? 'service'
  return { ...base, step: reachable }
}

function withServiceToggled(state: BookingState, id: string): BookingState {
  if (!state.catalog.services.some(service => service.id === id)) return state
  const serviceIds = toggleId(state.serviceIds, id)
  const keepBarber = state.barber === ANY_BARBER || isBarberValid(state.catalog, state.barber, serviceIds)
  // Длительность изменилась: выбранное время могло перестать помещаться.
  return { ...state, serviceIds, barber: keepBarber ? state.barber : null, slot: null }
}

function moveTo(state: BookingState, step: StepId): BookingState {
  if (state.submit.kind === 'submitting') return state
  if (stepIndex(step) > maxReachableIndex(state)) return state
  return { ...state, step, submit: { kind: 'idle' } }
}

function moveBy(state: BookingState, delta: 1 | -1): BookingState {
  const target = STEPS[stepIndex(state.step) + delta]
  if (target === undefined) return state
  if (delta === 1 && !isStepValid(state, state.step)) return state
  return moveTo(state, target)
}

export function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'toggleService':
      return withServiceToggled(state, action.id)
    case 'selectBarber':
      return action.barber === state.barber ? state : { ...state, barber: action.barber, slot: null }
    case 'selectDate':
      return action.dateKey === state.dateKey ? state : { ...state, dateKey: action.dateKey, slot: null }
    case 'selectSlot':
      return { ...state, slot: action.slot, submit: { kind: 'idle' } }
    case 'setName':
      return { ...state, name: action.name }
    case 'setPhone':
      // Стёрли все цифры — очищаем поле целиком, иначе «+998» не удалить.
      return { ...state, phone: uzLocalDigits(action.phone) ? formatUzPhone(action.phone) : '' }
    case 'next':
      return moveBy(state, 1)
    case 'back':
      return moveBy(state, -1)
    case 'goTo':
      return moveTo(state, action.step)
    default:
      return submitReducer(state, action)
  }
}

/** Ошибка отправки: возвращаем на нужный шаг; если это выбор времени/даты — сбрасываем слот. */
function withSubmitFailure(state: BookingState, message: string, step: StepId = 'confirm'): BookingState {
  const clearsSlot = stepIndex(step) <= stepIndex('time')
  const slot = clearsSlot ? null : state.slot
  return { ...state, step, slot, submit: { kind: 'error', message } }
}

function submitReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'submitStart':
      return toDraft(state) ? { ...state, submit: { kind: 'submitting' } } : state
    case 'submitSuccess':
      return { ...state, submit: { kind: 'done', booking: action.booking } }
    case 'submitFailure':
      return withSubmitFailure(state, action.message, action.step)
    case 'reset':
      return createInitialState({ catalog: state.catalog })
    default:
      return state
  }
}
