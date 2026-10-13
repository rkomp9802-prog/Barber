import type { AnalyticsData } from '@/lib/admin/analyticsApi'

import { BarberLoadTable } from './BarberLoadTable'
import { BookingsHeatmap } from './BookingsHeatmap'
import { ServicesBars } from './ServicesBars'
import { SummaryCards } from './SummaryCards'
import styles from './analytics.module.css'

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const noActivity = data.revenue.completedCount === 0 && data.cancellations.totalBookings === 0

  return (
    <div className={styles.dashboard}>
      {noActivity ? <p className={styles.notice}>За выбранный период записей нет.</p> : null}

      <SummaryCards revenue={data.revenue} cancellations={data.cancellations} retention={data.retention} />

      <section className={styles.panel} aria-labelledby="analytics-services">
        <h2 id="analytics-services" className={styles.panelTitle}>
          Популярные услуги
        </h2>
        <ServicesBars services={data.services.services} />
      </section>

      <section className={styles.panel} aria-labelledby="analytics-load">
        <h2 id="analytics-load" className={styles.panelTitle}>
          Загрузка барберов
        </h2>
        <BarberLoadTable barbers={data.load.barbers} />
      </section>

      <section className={styles.panel} aria-labelledby="analytics-heatmap">
        <h2 id="analytics-heatmap" className={styles.panelTitle}>
          Записи по дням и часам
        </h2>
        <BookingsHeatmap cells={data.heatmap.cells} />
      </section>
    </div>
  )
}
