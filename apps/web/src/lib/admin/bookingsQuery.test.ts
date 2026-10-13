import { describe, expect, it } from 'vitest'

import { ADMIN_PAGE_SIZE_DEFAULT } from '@barber/shared'

import {
  EMPTY_BOOKING_FILTERS,
  buildBookingsQuery,
  hasActiveBookingFilters,
  pageCount,
  type BookingFilters,
} from './bookingsQuery'

const FILLED: BookingFilters = {
  from: '2026-10-01',
  to: '2026-10-31',
  barberId: '5f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
  status: 'completed',
  source: 'admin',
  search: ' Иван ',
}

describe('buildBookingsQuery', () => {
  it('uses the default page size and ascending order without filters', () => {
    const query = buildBookingsQuery(EMPTY_BOOKING_FILTERS, 1)
    expect(query.page).toBe(1)
    expect(query.pageSize).toBe(ADMIN_PAGE_SIZE_DEFAULT)
    expect(query.order).toBe('asc')
    expect(query.status).toBeUndefined()
    expect(query.search).toBeUndefined()
  })

  it('wraps a single status into a list and trims the search text', () => {
    const query = buildBookingsQuery(FILLED, 3)
    expect(query.page).toBe(3)
    expect(query.status).toEqual(['completed'])
    expect(query.search).toBe('Иван')
    expect(query.source).toBe('admin')
  })

  it('treats whitespace-only text as no filter', () => {
    expect(buildBookingsQuery({ ...EMPTY_BOOKING_FILTERS, search: '   ' }, 1).search).toBeUndefined()
  })
})

describe('hasActiveBookingFilters', () => {
  it('is false for empty filters and true when any field is set', () => {
    expect(hasActiveBookingFilters(EMPTY_BOOKING_FILTERS)).toBe(false)
    expect(hasActiveBookingFilters({ ...EMPTY_BOOKING_FILTERS, from: '2026-10-01' })).toBe(true)
  })
})

describe('pageCount', () => {
  it('rounds up and never returns less than one page', () => {
    expect(pageCount(0, 20)).toBe(1)
    expect(pageCount(20, 20)).toBe(1)
    expect(pageCount(21, 20)).toBe(2)
  })
})
