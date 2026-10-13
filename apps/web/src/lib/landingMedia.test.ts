import { describe, expect, it } from 'vitest'

import { barberPhotoSrc, galleryItems, isUnoptimizedSrc, stockBarberSrc } from './landingMedia'

describe('stockBarberSrc', () => {
  it('cycles through barber-1..4', () => {
    expect([0, 1, 2, 3, 4, 5].map(stockBarberSrc)).toEqual([
      '/stock/barber-1.webp',
      '/stock/barber-2.webp',
      '/stock/barber-3.webp',
      '/stock/barber-4.webp',
      '/stock/barber-1.webp',
      '/stock/barber-2.webp',
    ])
  })
})

describe('barberPhotoSrc', () => {
  it('uses the barber photo when present', () => {
    expect(barberPhotoSrc({ photoUrl: 'https://cdn.example.com/a.jpg' }, 2)).toBe('https://cdn.example.com/a.jpg')
  })

  it('falls back to stock by index when photoUrl is null or blank', () => {
    expect(barberPhotoSrc({ photoUrl: null }, 1)).toBe('/stock/barber-2.webp')
    expect(barberPhotoSrc({ photoUrl: '   ' }, 5)).toBe('/stock/barber-2.webp')
  })
})

describe('galleryItems', () => {
  it('flattens portfolios of all barbers in order', () => {
    expect(
      galleryItems([
        { portfolio: ['/a.webp', '/b.webp'] },
        { portfolio: [] },
        { portfolio: ['https://x.test/c.jpg'] },
      ]),
    ).toEqual(['/a.webp', '/b.webp', 'https://x.test/c.jpg'])
  })

  it('falls back to work-1..5 when there are no portfolio items', () => {
    expect(galleryItems([{ portfolio: [] }, { portfolio: [] }])).toEqual([
      '/stock/work-1.webp',
      '/stock/work-2.webp',
      '/stock/work-3.webp',
      '/stock/work-4.webp',
      '/stock/work-5.webp',
    ])
    expect(galleryItems([])).toHaveLength(5)
  })
})

describe('isUnoptimizedSrc', () => {
  it('is false only for local paths starting with /', () => {
    expect(isUnoptimizedSrc('/stock/work-1.webp')).toBe(false)
    expect(isUnoptimizedSrc('https://x.test/a.jpg')).toBe(true)
    expect(isUnoptimizedSrc('stock/a.webp')).toBe(true)
  })
})
