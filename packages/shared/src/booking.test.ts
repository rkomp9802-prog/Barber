import { describe, expect, it } from 'vitest'

import { selectedServices, toggleId, totalDurationMin, totalPrice, validateClientName } from './booking'
import type { Service } from './types'

const services: Service[] = [
  { id: 'cut', name: 'Стрижка', description: '', durationMin: 60, price: 120000 },
  { id: 'beard', name: 'Борода', description: '', durationMin: 30, price: 70000 },
  { id: 'kids', name: 'Детская', description: '', durationMin: 45, price: 90000 },
]

describe('booking totals', () => {
  it('sums duration and price of the selected services', () => {
    const chosen = selectedServices(services, ['cut', 'beard'])
    expect(totalDurationMin(chosen)).toBe(90)
    expect(totalPrice(chosen)).toBe(190000)
  })

  it('is zero for an empty selection', () => {
    expect(totalDurationMin([])).toBe(0)
    expect(totalPrice([])).toBe(0)
  })
})

describe('toggleId', () => {
  it('adds and removes without mutating the input', () => {
    const ids = ['cut']
    expect(toggleId(ids, 'beard')).toEqual(['cut', 'beard'])
    expect(toggleId(ids, 'cut')).toEqual([])
    expect(ids).toEqual(['cut'])
  })
})

describe('validateClientName', () => {
  it('requires at least two letters', () => {
    expect(validateClientName(' И ')).toBeDefined()
    expect(validateClientName('Иван')).toBeUndefined()
  })
})
