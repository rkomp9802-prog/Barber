import { describe, expect, it } from 'vitest'

import { formatPrice, type AdminBookingDto } from '@barber/shared'

import { toBookingView } from './bookingView'

const BOOKING: AdminBookingDto = {
  id: 'b1',
  status: 'no_show',
  source: 'telegram',
  startsAt: '2026-10-13T05:30:00.000Z',
  endsAt: '2026-10-13T06:15:00.000Z',
  totalPrice: 120000,
  totalDurationMin: 45,
  barber: { id: 'x1', name: 'Азиз' },
  client: { id: 'c1', name: 'Иван', phone: '+998901234567' },
  services: [
    { serviceId: 's1', name: 'Стрижка', durationMin: 30, price: 80000 },
    { serviceId: 's2', name: 'Борода', durationMin: 15, price: 40000 },
  ],
  createdAt: '2026-10-10T00:00:00.000Z',
}

describe('toBookingView', () => {
  it('shows times in Asia/Tashkent (UTC+5)', () => {
    const view = toBookingView(BOOKING)
    expect(view.timeRange).toContain('10:30')
    expect(view.timeRange).toContain('11:15')
  })

  it('joins services and formats the total with the shared price formatter', () => {
    const view = toBookingView(BOOKING)
    expect(view.servicesText).toBe('Стрижка, Борода')
    expect(view.total).toBe(formatPrice(120000))
  })

  it('maps status and source to Russian labels and tones', () => {
    const view = toBookingView(BOOKING)
    expect(view.statusLabel).toBe('Не пришёл')
    expect(view.statusTone).toBe('muted')
    expect(view.sourceLabel).toBe('Telegram')
  })
})
