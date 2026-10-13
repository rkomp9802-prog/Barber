import { describe, expect, it } from 'vitest'

import type { AdminBarberDto, AdminServiceDto } from '@barber/shared'

import { ApiRequestError } from '../api'
import {
  adminBookingErrorMessage,
  buildCreateInput,
  buildRescheduleInput,
  canMarkAfterStart,
  clientNameError,
  dateTimeError,
  isoToTashkentParts,
  maskPhoneInput,
  serviceOptionsFor,
  summarizeServices,
  tashkentToIso,
} from './bookingForm'

// 2026-10-13 12:00 по Ташкенту (UTC+5, без летнего времени).
const NOW = new Date('2026-10-13T07:00:00.000Z')

describe('tashkentToIso / isoToTashkentParts', () => {
  it('converts Tashkent wall time to UTC', () => {
    expect(tashkentToIso('2026-10-13', '10:30')).toBe('2026-10-13T05:30:00.000Z')
  })

  it('round-trips through isoToTashkentParts', () => {
    const iso = tashkentToIso('2026-03-01', '00:15')
    expect(iso).not.toBeNull()
    expect(isoToTashkentParts(iso as string)).toEqual({ date: '2026-03-01', time: '00:15' })
  })

  it('shows late-evening Tashkent time on the same calendar day', () => {
    expect(isoToTashkentParts('2026-10-13T18:45:00.000Z')).toEqual({ date: '2026-10-13', time: '23:45' })
    expect(isoToTashkentParts('2026-10-13T19:30:00.000Z')).toEqual({ date: '2026-10-14', time: '00:30' })
  })

  it('rejects non-existent dates and malformed values', () => {
    expect(tashkentToIso('2026-02-31', '10:00')).toBeNull()
    expect(tashkentToIso('2026-10-13', '25:00')).toBeNull()
    expect(tashkentToIso('13.10.2026', '10:00')).toBeNull()
  })
})

describe('dateTimeError', () => {
  it('requires date and time', () => {
    expect(dateTimeError('', '10:00', NOW)).toBe('Укажите дату.')
    expect(dateTimeError('2026-10-13', '', NOW)).toBe('Укажите время.')
  })

  it('allows booking right now, but not on a past date', () => {
    expect(dateTimeError('2026-10-13', '12:05', NOW)).toBeNull()
    expect(dateTimeError('2026-10-12', '23:59', NOW)).toBe('Нельзя записать на прошедшую дату.')
  })

  it('stops at the 365-day manual horizon', () => {
    expect(dateTimeError('2027-10-13', '10:00', NOW)).toBeNull()
    expect(dateTimeError('2027-10-14', '10:00', NOW)).toMatch(/365/)
  })
})

describe('field validators', () => {
  it('checks client name length after trimming', () => {
    expect(clientNameError(' А ')).not.toBeNull()
    expect(clientNameError('  Иван  ')).toBeNull()
    expect(clientNameError('a'.repeat(61))).not.toBeNull()
  })

  it('masks the phone and keeps an empty field empty', () => {
    expect(maskPhoneInput('')).toBe('')
    expect(maskPhoneInput('901234567')).toBe('+998 90 123 45 67')
  })
})

const BARBER: AdminBarberDto = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Азиз',
  role: 'Барбер',
  bio: '',
  photoUrl: null,
  experienceYears: 3,
  isActive: true,
  sortOrder: 1,
  telegramLinked: false,
  services: [
    { serviceId: 's1', name: 'Стрижка', isEnabled: true, durationMin: null, price: null, effectiveDurationMin: 30, effectivePrice: 80000 },
    { serviceId: 's2', name: 'Борода', isEnabled: false, durationMin: null, price: null, effectiveDurationMin: 15, effectivePrice: 40000 },
    { serviceId: 's3', name: 'Архив', isEnabled: true, durationMin: 20, price: 50000, effectiveDurationMin: 20, effectivePrice: 50000 },
  ],
  portfolio: [],
  schedule: { workingHours: [], breaks: [] },
}

const SERVICES: AdminServiceDto[] = [
  { id: 's1', name: 'Стрижка', description: '', durationMin: 30, price: 80000, isActive: true, sortOrder: 1 },
  { id: 's2', name: 'Борода', description: '', durationMin: 15, price: 40000, isActive: true, sortOrder: 2 },
  { id: 's3', name: 'Архив', description: '', durationMin: 20, price: 50000, isActive: false, sortOrder: 3 },
]

describe('serviceOptionsFor / summarizeServices', () => {
  it('offers only active services the barber performs', () => {
    expect(serviceOptionsFor(BARBER, SERVICES)).toEqual([
      { id: 's1', name: 'Стрижка', durationMin: 30, price: 80000 },
    ])
    expect(serviceOptionsFor(undefined, SERVICES)).toEqual([])
  })

  it('sums price and duration of selected services', () => {
    const options = [
      { id: 'a', name: 'A', durationMin: 30, price: 80000 },
      { id: 'b', name: 'B', durationMin: 15, price: 40000 },
    ]
    expect(summarizeServices(options, ['a', 'b'])).toEqual({ price: 120000, durationMin: 45 })
    expect(summarizeServices(options, [])).toEqual({ price: 0, durationMin: 0 })
  })
})

const DRAFT = {
  barberId: BARBER.id,
  serviceIds: ['s1'],
  date: '2026-10-13',
  time: '14:00',
  clientName: '  Иван ',
  phone: '+998 90 123 45 67',
  force: false,
}

describe('buildCreateInput', () => {
  it('builds the POST body with UTC start, E.164 phone and trimmed name', () => {
    expect(buildCreateInput(DRAFT, NOW)).toEqual({
      input: {
        barberId: BARBER.id,
        serviceIds: ['s1'],
        startsAt: '2026-10-13T09:00:00.000Z',
        client: { name: 'Иван', phone: '+998901234567' },
        force: false,
      },
    })
  })

  it('reports the first problem instead of building a body', () => {
    expect(buildCreateInput({ ...DRAFT, serviceIds: [] }, NOW)).toEqual({ error: 'Выберите хотя бы одну услугу.' })
    expect(buildCreateInput({ ...DRAFT, phone: '+998 90' }, NOW)).toEqual({
      error: 'Телефон в формате +998 и 9 цифр.',
    })
    expect(buildCreateInput({ ...DRAFT, barberId: '' }, NOW)).toEqual({ error: 'Выберите барбера.' })
  })
})

describe('buildRescheduleInput', () => {
  it('sends the new start and the force flag', () => {
    expect(buildRescheduleInput({ date: '2026-10-14', time: '09:30', force: true }, NOW)).toEqual({
      input: { startsAt: '2026-10-14T04:30:00.000Z', force: true },
    })
  })
})

describe('canMarkAfterStart', () => {
  it('allows completed/no_show only once the booking has started', () => {
    expect(canMarkAfterStart('2026-10-13T07:00:00.000Z', NOW)).toBe(true)
    expect(canMarkAfterStart('2026-10-13T08:00:00.000Z', NOW)).toBe(false)
  })
})

describe('adminBookingErrorMessage', () => {
  it('explains SLOT_TAKEN in Russian', () => {
    expect(adminBookingErrorMessage(new ApiRequestError('SLOT_TAKEN', 'x', 409))).toBe(
      'Время уже занято. Выберите другое время.',
    )
  })

  it('mentions the force option for OUTSIDE_WORKING_HOURS', () => {
    expect(adminBookingErrorMessage(new ApiRequestError('OUTSIDE_WORKING_HOURS', 'x', 422))).toMatch(/записать всё равно/)
  })

  it('falls back to the shared error text for other errors', () => {
    expect(adminBookingErrorMessage(new ApiRequestError('BOOKING_NOT_ACTIVE', 'x', 409))).toMatch(/уже отменена/)
    expect(adminBookingErrorMessage(new Error('Сбой'))).toBe('Сбой')
  })
})
