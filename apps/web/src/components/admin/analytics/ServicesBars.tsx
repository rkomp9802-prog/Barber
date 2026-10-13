import type { ServiceStatsDto } from '@barber/shared'

import { EmptyBlock } from '../StateBlocks'
import { clampPercent, formatPercent } from './format'
import styles from './analytics.module.css'

export function ServicesBars({ services }: { services: readonly ServiceStatsDto[] }) {
  if (services.length === 0) return <EmptyBlock text="За период услуги не оказывались." />

  return (
    <ol className={styles.bars}>
      {services.map(item => {
        const share = formatPercent(item.sharePercent)
        return (
          <li key={item.serviceId} className={styles.barRow}>
            <div className={styles.barHead}>
              <span className={styles.barName}>{item.serviceName}</span>
              <span className={styles.barValue}>
                {item.bookingsCount} · {share}
              </span>
            </div>
            <div className={styles.barTrack} role="img" aria-label={`${item.serviceName}: ${share} записей`}>
              <div className={styles.barFill} style={{ width: `${clampPercent(item.sharePercent)}%` }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
