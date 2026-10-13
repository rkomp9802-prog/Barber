import { DEFAULT_SETTINGS } from '@barber/shared'
import { describe, expect, it } from 'vitest'
import { quoteForBarber, uniqueIds, type BarberServiceLink, type CatalogService } from '../../src/domain/pricing'
import { parseBookingRules } from '../../src/domain/settings'

const haircut: CatalogService = { id: 'haircut', name: 'Стрижка', durationMin: 60, price: 120_000, isActive: true }
const beard: CatalogService = { id: 'beard', name: 'Борода', durationMin: 30, price: 70_000, isActive: true }

function link(serviceId: string, extra: Partial<BarberServiceLink> = {}): BarberServiceLink {
  return { barberId: 'b1', serviceId, durationMin: null, price: null, isEnabled: true, ...extra }
}

describe('quoteForBarber', () => {
  it('суммирует длительность и цену услуг', () => {
    const quote = quoteForBarber('b1', [haircut, beard], [link('haircut'), link('beard')])
    expect(quote?.totalDurationMin).toBe(90)
    expect(quote?.totalPrice).toBe(190_000)
    expect(quote?.items.map(item => item.serviceId)).toEqual(['haircut', 'beard'])
  })

  it('учитывает переопределения барбера', () => {
    const quote = quoteForBarber('b1', [haircut], [link('haircut', { durationMin: 45, price: 150_000 })])
    expect(quote).toMatchObject({ totalDurationMin: 45, totalPrice: 150_000 })
    expect(quote?.items[0]).toMatchObject({ durationMin: 45, price: 150_000, name: 'Стрижка' })
  })

  it('null, если барбер не делает услугу, она выключена у барбера или в каталоге', () => {
    expect(quoteForBarber('b1', [haircut, beard], [link('haircut')])).toBeNull()
    expect(quoteForBarber('b1', [haircut], [link('haircut', { isEnabled: false })])).toBeNull()
    expect(quoteForBarber('b1', [{ ...haircut, isActive: false }], [link('haircut')])).toBeNull()
    expect(quoteForBarber('b2', [haircut], [link('haircut')])).toBeNull()
    expect(quoteForBarber('b1', [], [])).toBeNull()
  })

  it('uniqueIds убирает повторы', () => {
    expect(uniqueIds(['a', 'b', 'a'])).toEqual(['a', 'b'])
  })
})

describe('parseBookingRules', () => {
  it('без строк в settings — значения по умолчанию', () => {
    expect(parseBookingRules({})).toEqual({
      slotStepMin: DEFAULT_SETTINGS.slot_step_min,
      minNoticeMin: DEFAULT_SETTINGS.min_notice_min,
      horizonDays: DEFAULT_SETTINGS.booking_horizon_days,
      cancelCutoffMin: DEFAULT_SETTINGS.cancel_cutoff_min,
      timezone: 'Asia/Tashkent',
      reviewPublicMinRating: DEFAULT_SETTINGS.review_public_min_rating,
    })
  })

  it('берёт значения из базы и подменяет испорченные', () => {
    const parsed = parseBookingRules({ slot_step_min: 30, min_notice_min: '60', timezone: 'Mars/Base', booking_horizon_days: -5 })
    expect(parsed.slotStepMin).toBe(30)
    expect(parsed.minNoticeMin).toBe(60)
    expect(parsed.timezone).toBe('Asia/Tashkent')
    expect(parsed.horizonDays).toBe(DEFAULT_SETTINGS.booking_horizon_days)
  })
})
