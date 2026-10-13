import { describe, expect, it } from 'vitest'

import type { HeatmapCellDto } from '@barber/shared'

import { buildHeatmapGrid, intensityOf } from './analyticsHeatmap'

const cell = (dayOfWeek: number, hour: number, bookingsCount: number): HeatmapCellDto => ({
  dayOfWeek,
  hour,
  bookingsCount,
})

describe('buildHeatmapGrid', () => {
  it('без данных возвращает семь пустых строк и total 0', () => {
    const grid = buildHeatmapGrid([])
    expect(grid.total).toBe(0)
    expect(grid.max).toBe(0)
    expect(grid.hours).toEqual([])
    expect(grid.days.map(day => day.short)).toEqual(['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'])
  })

  it('колонки идут от первого до последнего часа с данными, включая пустые внутри', () => {
    const grid = buildHeatmapGrid([cell(0, 9, 2), cell(0, 12, 1), cell(4, 20, 5)])
    expect(grid.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(grid.days[0]?.counts[0]).toBe(2)
    expect(grid.days[0]?.counts[3]).toBe(1)
    expect(grid.days[0]?.counts[1]).toBe(0)
    expect(grid.days[4]?.counts[11]).toBe(5)
  })

  it('суммирует дубликаты и считает максимум и итог', () => {
    const grid = buildHeatmapGrid([cell(2, 10, 3), cell(2, 10, 4), cell(6, 10, 1)])
    expect(grid.days[2]?.counts[0]).toBe(7)
    expect(grid.max).toBe(7)
    expect(grid.total).toBe(8)
  })

  it('пропускает ячейки с некорректными днями и часами', () => {
    const grid = buildHeatmapGrid([cell(7, 10, 9), cell(0, 24, 9), cell(-1, 10, 9), cell(1, 15, 2)])
    expect(grid.total).toBe(2)
    expect(grid.hours).toEqual([15])
  })
})

describe('intensityOf', () => {
  it('ноль для пустых ячеек и пустой шкалы', () => {
    expect(intensityOf(0, 10)).toBe(0)
    expect(intensityOf(5, 0)).toBe(0)
  })

  it('максимум даёт 1, а слабые ненулевые ячейки не теряются', () => {
    expect(intensityOf(10, 10)).toBe(1)
    expect(intensityOf(1, 100)).toBe(0.15)
    expect(intensityOf(5, 10)).toBe(0.5)
  })
})
