import { describe, expect, it } from 'vitest'

import { dayAvailability } from './dayAvailability'
import type { DaysState } from './useAvailability'

const DAY = '2026-10-14'

describe('dayAvailability', () => {
  it('пока дни грузятся — недоступен, даже если день потом окажется свободным', () => {
    const state: DaysState = { status: 'loading' }
    expect(dayAvailability(state, DAY)).toBe(false)
  })

  it('загружено и есть слоты — доступен', () => {
    const state: DaysState = { status: 'ready', data: [{ date: DAY, hasSlots: true }] }
    expect(dayAvailability(state, DAY)).toBe(true)
  })

  it('загружено и слотов нет — недоступен', () => {
    const state: DaysState = { status: 'ready', data: [{ date: DAY, hasSlots: false }] }
    expect(dayAvailability(state, DAY)).toBe(false)
  })

  it('день не из ответа — доступен (как и раньше)', () => {
    const state: DaysState = { status: 'ready', data: [{ date: '2026-10-15', hasSlots: false }] }
    expect(dayAvailability(state, DAY)).toBe(true)
  })

  it('ошибка загрузки — доступен (осознанный fallback)', () => {
    const state: DaysState = { status: 'error', message: 'Сеть недоступна' }
    expect(dayAvailability(state, DAY)).toBe(true)
  })
})
