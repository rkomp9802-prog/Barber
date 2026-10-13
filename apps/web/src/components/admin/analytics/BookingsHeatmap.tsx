import type { CSSProperties } from 'react'

import { plural, type HeatmapCellDto } from '@barber/shared'
import { buildHeatmapGrid, intensityOf } from '@/lib/admin/analyticsHeatmap'

import { EmptyBlock } from '../StateBlocks'
import styles from './analytics.module.css'

export function BookingsHeatmap({ cells }: { cells: readonly HeatmapCellDto[] }) {
  const grid = buildHeatmapGrid(cells)
  if (grid.total === 0) return <EmptyBlock text="За период нет завершённых записей." />

  return (
    <div className={styles.heatWrap}>
      <table className={styles.heatmap}>
        <caption className={styles.visuallyHidden}>Завершённые записи по дням недели и часам</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className={styles.visuallyHidden}>День</span>
            </th>
            {grid.hours.map(hour => (
              <th key={hour} scope="col" className={styles.heatHour}>
                {hour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.days.map(day => (
            <tr key={day.full}>
              <th scope="row" className={styles.heatDay} title={day.full}>
                {day.short}
              </th>
              {day.counts.map((count, index) => {
                const hour = grid.hours[index]
                const text = `${day.full}, ${hour}:00 — ${count} ${plural(count, ['запись', 'записи', 'записей'])}`
                const style = { '--intensity': intensityOf(count, grid.max) } as CSSProperties
                return (
                  <td key={hour} className={styles.heatCell} style={style} title={text} aria-label={text}>
                    {count > 0 ? count : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.heatLegend}>Чем темнее ячейка, тем больше завершённых записей в этот час.</p>
    </div>
  )
}
