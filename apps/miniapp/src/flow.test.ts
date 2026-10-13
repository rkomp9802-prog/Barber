import type { BarberDto, BookingDto, SlotDto } from '@barber/shared'
import { describe, expect, it } from 'vitest'

import { SLOT_TAKEN_MESSAGE } from './errors'
import {
  canProceed,
  createInitialFlow,
  eligibleBarbers,
  type FlowAction,
  flowReducer,
  type FlowState,
  MAX_SERVICES,
  previousStep,
  stepNumber,
} from './flow'

const slot: SlotDto = { startsAt: '2026-10-12T05:00:00Z', time: '10:00', barberIds: ['b1'] }

function run(state: FlowState, ...actions: FlowAction[]): FlowState {
  return actions.reduce(flowReducer, state)
}

function readyForConfirm(): FlowState {
  return run(
    createInitialFlow('Азиз'),
    { type: 'toggleService', serviceId: 's1' },
    { type: 'next' },
    { type: 'selectBarber', barberId: 'any' },
    { type: 'next' },
    { type: 'selectDate', date: '2026-10-12' },
    { type: 'next' },
    { type: 'selectSlot', slot },
    { type: 'next' },
    { type: 'setPhone', phone: '+998 90 123 45 67' },
    { type: 'next' },
  )
}

describe('flowReducer', () => {
  it('starts on services with the prefilled name', () => {
    const state = createInitialFlow('Азиз')
    expect(state.step).toBe('services')
    expect(state.draft.name).toBe('Азиз')
    expect(canProceed(state)).toBe(false)
  })

  it('does not advance without a selection', () => {
    const state = flowReducer(createInitialFlow(), { type: 'next' })
    expect(state.step).toBe('services')
  })

  it('walks through all steps to confirm', () => {
    const state = readyForConfirm()
    expect(state.step).toBe('confirm')
    expect(state.draft).toMatchObject({ serviceIds: ['s1'], barberId: 'any', date: '2026-10-12', slot })
  })

  it('does not mutate the previous state', () => {
    const initial = createInitialFlow()
    const next = flowReducer(initial, { type: 'toggleService', serviceId: 's1' })
    expect(initial.draft.serviceIds).toEqual([])
    expect(next.draft.serviceIds).toEqual(['s1'])
  })

  it('toggles services and caps the selection', () => {
    const ids = Array.from({ length: MAX_SERVICES + 1 }, (_, i) => `s${i}`)
    const state = run(createInitialFlow(), ...ids.map(serviceId => ({ type: 'toggleService', serviceId }) as const))
    expect(state.draft.serviceIds).toHaveLength(MAX_SERVICES)
    const removed = flowReducer(state, { type: 'toggleService', serviceId: 's0' })
    expect(removed.draft.serviceIds).not.toContain('s0')
  })

  it('resets dependent choices when an earlier choice changes', () => {
    const confirm = readyForConfirm()
    const otherDate = flowReducer(confirm, { type: 'selectDate', date: '2026-10-13' })
    expect(otherDate.draft.slot).toBeNull()
    const otherBarber = flowReducer(confirm, { type: 'selectBarber', barberId: 'b2' })
    expect(otherBarber.draft).toMatchObject({ date: null, slot: null })
    const otherServices = flowReducer(confirm, { type: 'toggleService', serviceId: 's2' })
    expect(otherServices.draft).toMatchObject({ barberId: null, date: null, slot: null })
  })

  it('keeps choices when the same value is selected again', () => {
    const confirm = readyForConfirm()
    expect(flowReducer(confirm, { type: 'selectDate', date: '2026-10-12' })).toBe(confirm)
  })

  it('requires a valid name and full phone on contacts', () => {
    const contacts = flowReducer(readyForConfirm(), { type: 'back' })
    expect(contacts.step).toBe('contacts')
    expect(canProceed(flowReducer(contacts, { type: 'setName', name: 'А' }))).toBe(false)
    expect(canProceed(flowReducer(contacts, { type: 'setPhone', phone: '+998 90 123' }))).toBe(false)
    expect(canProceed(contacts)).toBe(true)
  })

  it('returns to time with a notice and reloads slots on SLOT_TAKEN', () => {
    const confirm = readyForConfirm()
    const state = flowReducer(confirm, { type: 'slotTaken' })
    expect(state.step).toBe('time')
    expect(state.draft.slot).toBeNull()
    expect(state.draft.date).toBe('2026-10-12')
    expect(state.notice).toBe(SLOT_TAKEN_MESSAGE)
    expect(state.slotsVersion).toBe(confirm.slotsVersion + 1)
    expect(flowReducer(state, { type: 'dismissNotice' }).notice).toBeNull()
  })

  it('uses a custom message for other rejected times', () => {
    const state = flowReducer(readyForConfirm(), { type: 'slotTaken', message: 'Слишком рано' })
    expect(state.notice).toBe('Слишком рано')
  })

  it('moves to success after booking', () => {
    const booking = { id: 'bk1' } as BookingDto
    const state = flowReducer(readyForConfirm(), { type: 'booked', booking })
    expect(state.step).toBe('success')
    expect(state.booking).toBe(booking)
    expect(flowReducer(state, { type: 'back' })).toBe(state)
  })
})

describe('navigation helpers', () => {
  it('previousStep exits from the first step and from success', () => {
    expect(previousStep('services')).toBeNull()
    expect(previousStep('success')).toBeNull()
    expect(previousStep('time')).toBe('date')
  })

  it('stepNumber counts six visible steps', () => {
    expect(stepNumber('services')).toEqual({ current: 1, total: 6 })
    expect(stepNumber('confirm')).toEqual({ current: 6, total: 6 })
  })
})

describe('eligibleBarbers', () => {
  const barber = (id: string, serviceIds: string[]): BarberDto =>
    ({ id, name: id, serviceIds }) as unknown as BarberDto

  it('keeps only barbers offering every selected service', () => {
    const barbers = [barber('b1', ['s1', 's2']), barber('b2', ['s1']), barber('b3', ['s2'])]
    expect(eligibleBarbers(barbers, ['s1', 's2']).map(b => b.id)).toEqual(['b1'])
    expect(eligibleBarbers(barbers, ['s1']).map(b => b.id)).toEqual(['b1', 'b2'])
  })
})
