import { describe, expect, it } from 'vitest'

import { ANY_BARBER, type BookingDto } from '@barber/shared'

import { MOCK_BARBER_IDS, MOCK_SERVICE_IDS, barbers, services } from '@/data/mock'

import {
  bookingReducer,
  createInitialState,
  isStepValid,
  maxReachableIndex,
  qualifyingBarbers,
  toDraft,
  type BookingAction,
  type BookingState,
  type InitialSelection,
} from './bookingState'
import { bookingSummary } from './bookingSummary'

const S = MOCK_SERVICE_IDS
const B = MOCK_BARBER_IDS
const CATALOG = { services, barbers }
const SLOT_1100 = { time: '11:00', startsAt: '2026-10-12T06:00:00.000Z' }

function init(selection?: InitialSelection): BookingState {
  return createInitialState({ catalog: CATALOG, selection })
}

function run(state: BookingState, ...actions: BookingAction[]): BookingState {
  return actions.reduce(bookingReducer, state)
}

const COMPLETE: BookingAction[] = [
  { type: 'toggleService', id: S.haircut },
  { type: 'next' },
  { type: 'selectBarber', barber: B.timur },
  { type: 'next' },
  { type: 'selectDate', dateKey: '2026-10-12' },
  { type: 'next' },
  { type: 'selectSlot', slot: SLOT_1100 },
  { type: 'next' },
  { type: 'setName', name: '  Иван ' },
  { type: 'setPhone', phone: '901234567' },
  { type: 'next' },
]

function bookingFixture(): BookingDto {
  return {
    id: 'b1',
    status: 'confirmed',
    source: 'web',
    startsAt: SLOT_1100.startsAt,
    endsAt: '2026-10-12T07:00:00.000Z',
    totalPrice: 120000,
    totalDurationMin: 60,
    barber: { id: B.timur, name: 'Тимур' },
    client: { name: 'Иван', phone: '+998901234567' },
    services: [{ serviceId: S.haircut, name: 'Мужская стрижка', durationMin: 60, price: 120000 }],
    manageToken: 't1',
    canChange: true,
    telegramLink: null,
    holdExpiresAt: null,
  }
}

describe('qualifyingBarbers', () => {
  it('returns only barbers who do every selected service', () => {
    const ids = qualifyingBarbers(barbers, [S.haircut, S.shave]).map(barber => barber.id)
    expect(ids).toEqual([B.timur])
  })

  it('returns empty list when nothing is selected or nobody qualifies', () => {
    expect(qualifyingBarbers(barbers, [])).toEqual([])
    expect(qualifyingBarbers(barbers, [S.kids, S.shave])).toEqual([])
  })
})

describe('createInitialState', () => {
  it('starts on the service step by default', () => {
    expect(init().step).toBe('service')
  })

  it('jumps to the barber step when a service comes from the link', () => {
    const state = init({ serviceId: S.beard })
    expect(state).toMatchObject({ step: 'barber', serviceIds: [S.beard], barber: null })
  })

  it('jumps to the date step when service and a qualifying barber are given', () => {
    expect(init({ serviceId: S.beard, barber: B.rustam }).step).toBe('date')
    expect(init({ serviceId: S.beard, barber: ANY_BARBER }).step).toBe('date')
  })

  it('drops a barber who does not do the requested service', () => {
    const state = init({ serviceId: S.kids, barber: B.rustam })
    expect(state).toMatchObject({ step: 'barber', barber: null })
  })

  it('keeps a preselected barber while services are not chosen yet', () => {
    expect(init({ barber: B.aziz })).toMatchObject({ step: 'service', barber: B.aziz })
  })
})

describe('bookingReducer', () => {
  it('walks through all steps to confirm', () => {
    const state = run(init(), ...COMPLETE)
    expect(state.step).toBe('confirm')
    expect(toDraft(state)).toEqual({
      serviceIds: [S.haircut],
      barber: B.timur,
      dateKey: '2026-10-12',
      slot: SLOT_1100,
      name: 'Иван',
      phone: '+998 90 123 45 67',
    })
  })

  it('does not move forward from an invalid step', () => {
    expect(run(init(), { type: 'next' }).step).toBe('service')
  })

  it('does not mutate the previous state', () => {
    const before = init()
    const after = bookingReducer(before, { type: 'toggleService', id: S.beard })
    expect(before.serviceIds).toEqual([])
    expect(after.serviceIds).toEqual([S.beard])
  })

  it('toggles services on and off and ignores unknown ids', () => {
    const state = run(
      init(),
      { type: 'toggleService', id: S.beard },
      { type: 'toggleService', id: S.shave },
      { type: 'toggleService', id: S.beard },
      { type: 'toggleService', id: 'nope' },
    )
    expect(state.serviceIds).toEqual([S.shave])
  })

  it('resets barber that no longer qualifies and the slot after a service change', () => {
    const base = run(init(), ...COMPLETE.slice(0, 7))
    const state = bookingReducer(base, { type: 'toggleService', id: S.kids })
    expect(state.barber).toBeNull()
    expect(state.slot).toBeNull()
  })

  it('keeps «any» barber when services change', () => {
    const state = run(
      init(),
      { type: 'toggleService', id: S.haircut },
      { type: 'selectBarber', barber: ANY_BARBER },
      { type: 'toggleService', id: S.beard },
    )
    expect(state.barber).toBe(ANY_BARBER)
  })

  it('clears the slot when the date or barber changes', () => {
    const base = run(init(), ...COMPLETE.slice(0, 7))
    expect(bookingReducer(base, { type: 'selectDate', dateKey: '2026-10-13' }).slot).toBeNull()
    expect(bookingReducer(base, { type: 'selectBarber', barber: B.aziz }).slot).toBeNull()
    expect(bookingReducer(base, { type: 'selectDate', dateKey: '2026-10-12' }).slot).toEqual(SLOT_1100)
  })

  it('formats the phone with the +998 mask and clears it when digits are erased', () => {
    const typed = bookingReducer(init(), { type: 'setPhone', phone: '+998901234567' })
    expect(typed.phone).toBe('+998 90 123 45 67')
    expect(bookingReducer(typed, { type: 'setPhone', phone: '+998 ' }).phone).toBe('')
  })

  it('goes back and allows jumping only to reachable steps', () => {
    const state = run(init(), ...COMPLETE)
    expect(bookingReducer(state, { type: 'back' }).step).toBe('contacts')
    expect(bookingReducer(state, { type: 'goTo', step: 'barber' }).step).toBe('barber')
    const fresh = init()
    expect(bookingReducer(fresh, { type: 'goTo', step: 'time' }).step).toBe('service')
    expect(bookingReducer(fresh, { type: 'back' }).step).toBe('service')
  })

  it('tracks the submit lifecycle and blocks navigation while submitting', () => {
    const ready = run(init(), ...COMPLETE)
    const submitting = bookingReducer(ready, { type: 'submitStart' })
    expect(submitting.submit).toEqual({ kind: 'submitting' })
    expect(bookingReducer(submitting, { type: 'back' }).step).toBe('confirm')

    const failed = bookingReducer(submitting, { type: 'submitFailure', message: 'Ошибка' })
    expect(failed.submit).toEqual({ kind: 'error', message: 'Ошибка' })

    const booking = bookingFixture()
    const done = bookingReducer(submitting, { type: 'submitSuccess', booking })
    expect(done.submit).toEqual({ kind: 'done', booking })
    expect(bookingReducer(done, { type: 'reset' })).toEqual(init())
  })

  it('returns to the time step with the slot cleared when the slot was taken', () => {
    const submitting = run(init(), ...COMPLETE, { type: 'submitStart' })
    const failed = bookingReducer(submitting, { type: 'submitFailure', message: 'Занято', step: 'time' })
    expect(failed).toMatchObject({ step: 'time', slot: null, submit: { kind: 'error', message: 'Занято' } })
  })

  it('refuses to start submitting an incomplete booking', () => {
    const state = bookingReducer(init(), { type: 'submitStart' })
    expect(state.submit.kind).toBe('idle')
  })
})

describe('validation and summary', () => {
  it('reports the furthest reachable step', () => {
    expect(maxReachableIndex(init())).toBe(0)
    expect(maxReachableIndex(run(init(), ...COMPLETE))).toBe(5)
  })

  it('rejects «any» barber when nobody does the service combination', () => {
    const state = run(
      init(),
      { type: 'toggleService', id: S.kids },
      { type: 'toggleService', id: S.shave },
      { type: 'selectBarber', barber: ANY_BARBER },
    )
    expect(isStepValid(state, 'barber')).toBe(false)
  })

  it('sums price and duration and names the barber', () => {
    const state = run(
      init(),
      { type: 'toggleService', id: S.haircut },
      { type: 'toggleService', id: S.beard },
      { type: 'selectBarber', barber: ANY_BARBER },
    )
    const summary = bookingSummary(state)
    expect(summary.price).toBe(190000)
    expect(summary.durationMin).toBe(90)
    expect(summary.barberName).toBe('Любой свободный')
    expect(bookingSummary({ ...state, barber: B.aziz }).barberName).toBe('Азиз')
  })
})
