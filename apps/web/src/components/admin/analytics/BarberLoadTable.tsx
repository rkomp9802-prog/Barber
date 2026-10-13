import { formatDuration, formatPrice } from '@barber/shared'
import type { BarberLoadDto } from '@barber/shared'

import { EmptyBlock } from '../StateBlocks'
import styles from './analytics.module.css'

export function BarberLoadTable({ barbers }: { barbers: readonly BarberLoadDto[] }) {
  if (barbers.length === 0) return <EmptyBlock text="За период у барберов не было записей." />

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Загрузка барберов за выбранный период</caption>
        <thead>
          <tr>
            <th scope="col">Барбер</th>
            <th scope="col" className={styles.numeric}>
              Записи
            </th>
            <th scope="col" className={styles.numeric}>
              Часы работы
            </th>
            <th scope="col" className={styles.numeric}>
              Выручка
            </th>
          </tr>
        </thead>
        <tbody>
          {barbers.map(barber => (
            <tr key={barber.barberId}>
              <th scope="row">{barber.barberName}</th>
              <td className={styles.numeric}>{barber.completedCount}</td>
              <td className={styles.numeric}>{formatDuration(barber.workedMinutes)}</td>
              <td className={styles.numeric}>{formatPrice(barber.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
