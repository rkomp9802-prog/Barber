import { describe, expect, it } from 'vitest'

import { ANY_BARBER } from '@barber/shared'

import { MOCK_BARBER_IDS, MOCK_SERVICE_IDS } from '@/data/mock'

import {
  BASE_SLOTS,
  SLOTS_ERROR_MESSAGE,
  barberSlots,
  computeSlots,
  createBooking,
  fetchSlots,
  isAbortError,
  tashkentMinutesNow,
} from './mockApi'
import type { BookingDraft } from './types'

const S = MOCK_SERVICE_IDS
const B = MOCK_BARBER_IDS
/** 2026-10-11 — воскресенье, 2026-10-12 — понедельник. */
const SUNDAY = '2026-10-11'
const MONDAY = '2026-10-12'
/** Утро до открытия (06:00 по Ташкенту, UTC+5), чтобы «сегодня» не съедало слоты. */
const EARLY = new Date('2026-10-10T01:00:00Z')

const DRAFT: BookingDraft = {
  serviceIds: [S.haircut],
  barber: B.timur,
  dateKey: MONDAY,
  slot: { time: '11:00', startsAt: '2026-10-12T06:00:00.000Z' },
  name: 'Иван',
  phone: '+998 90 123 45 67',
}

describe('barberSlots', () => {
  it('returns the base test slots on a regular weekday', () => {
    expect(barberSlots(B.timur, MONDAY, 60, EARLY)).toEqual([...BASE_SLOTS])
  })

  it('returns nothing on a barber day off (Daniyar on Sunday)', () => {
    expect(barberSlots(B.daniyar, SUNDAY, 60, EARLY)).toEqual([])
  })

  it('respects Sunday hours 11:00–19:00', () => {
    expect(barberSlots(B.timur, SUNDAY, 60, EARLY)).toEqual(['11:00', '12:00', '14:00', '15:00'])
    expect(barberSlots(B.timur, SUNDAY, 300, EARLY)).toEqual(['11:00', '12:00', '14:00'])
  })

  it('drops slots that would end after closing time', () => {
    expect(barberSlots(B.timur, MONDAY, 6 * 60 + 30, EARLY)).toEqual(['10:00', '11:00', '12:00', '14:00'])
  })

  it('drops slots already in the past today (Tashkent time)', () => {
    const noonInTashkent = new Date(`${MONDAY}T07:30:00Z`) // 12:30 в Ташкенте
    expect(barberSlots(B.timur, MONDAY, 60, noonInTashkent)).toEqual(['14:00', '15:00'])
  })
})

describe('computeSlots', () => {
  it('merges slots of all qualifying barbers for «any»', () => {
    const query = { barber: ANY_BARBER, serviceIds: [S.kids], dateKey: SUNDAY, durationMin: 45 }
    // Азиз работает в воскресенье, Данияр — нет: слоты всё равно есть.
    expect(computeSlots(query, EARLY)).toEqual(['11:00', '12:00', '14:00', '15:00'])
  })

  it('returns nothing for a barber who does not do the service', () => {
    const query = { barber: B.daniyar, serviceIds: [S.shave], dateKey: MONDAY, durationMin: 45 }
    expect(computeSlots(query, EARLY)).toEqual([])
  })
})

describe('tashkentMinutesNow', () => {
  it('converts UTC to minutes since midnight in Tashkent', () => {
    expect(tashkentMinutesNow(new Date('2026-10-12T07:30:00Z'))).toBe(12 * 60 + 30)
  })
})

describe('fetchSlots', () => {
  const query = { barber: B.timur, serviceIds: [S.haircut], dateKey: MONDAY, durationMin: 60 }

  it('resolves with slots after the delay', async () => {
    await expect(fetchSlots(query, { delayMs: 0, now: EARLY })).resolves.toEqual([...BASE_SLOTS])
  })

  it('fails in demo error mode', async () => {
    await expect(fetchSlots(query, { delayMs: 0, fail: true })).rejects.toThrow(SLOTS_ERROR_MESSAGE)
  })

  it('rejects with AbortError when the request is cancelled', async () => {
    const controller = new AbortController()
    const pending = fetchSlots(query, { delayMs: 50, signal: controller.signal })
    controller.abort()
    const error = await pending.catch((reason: unknown) => reason)
    expect(isAbortError(error)).toBe(true)
  })

  it('rejects immediately for an already aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = await fetchSlots(query, { delayMs: 0, signal: controller.signal }).catch((reason: unknown) => reason)
    expect(isAbortError(error)).toBe(true)
    expect(isAbortError(new Error('x'))).toBe(false)
  })
})

describe('createBooking', () => {
  it('returns random id and manage token for a specific barber', async () => {
    const first = await createBooking(DRAFT, { delayMs: 0, now: EARLY })
    const second = await createBooking(DRAFT, { delayMs: 0, now: EARLY })
    expect(first.barber.id).toBe(B.timur)
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(first.manageToken).not.toBe(first.id)
    expect(second.id).not.toBe(first.id)
  })

  it('assigns the first qualifying barber who is free for «any»', async () => {
    const draft: BookingDraft = {
      ...DRAFT,
      serviceIds: [S.kids],
      barber: ANY_BARBER,
      dateKey: SUNDAY,
      slot: { time: '12:00', startsAt: '2026-10-11T07:00:00.000Z' },
    }
    const result = await createBooking(draft, { delayMs: 0, now: EARLY })
    expect(result.barber.id).toBe(B.aziz)
  })

  it('rejects invalid client data', async () => {
    await expect(createBooking({ ...DRAFT, name: 'И' }, { delayMs: 0, now: EARLY })).rejects.toThrow('минимум 2')
    await expect(createBooking({ ...DRAFT, phone: '+998 90' }, { delayMs: 0, now: EARLY })).rejects.toThrow('номер')
    await expect(createBooking({ ...DRAFT, serviceIds: [] }, { delayMs: 0, now: EARLY })).rejects.toThrow('услугу')
  })

  it('rejects a time that is not available', async () => {
    const draft: BookingDraft = { ...DRAFT, barber: B.daniyar, dateKey: SUNDAY }
    await expect(createBooking(draft, { delayMs: 0, now: EARLY })).rejects.toThrow('занято')
  })
})
