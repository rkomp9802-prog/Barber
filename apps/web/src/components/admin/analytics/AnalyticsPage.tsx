'use client'

import { useState } from 'react'

import { loadAnalytics } from '@/lib/admin/analyticsApi'
import { DEFAULT_PERIOD_PRESET, presetRange, type DateRange } from '@/lib/admin/analyticsPeriod'
import { useAsyncData } from '@/lib/admin/useAsyncData'

import { AsyncContent } from '../StateBlocks'
import { AnalyticsDashboard } from './AnalyticsDashboard'
import { PeriodPicker } from './PeriodPicker'
import styles from './analytics.module.css'

export function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange(DEFAULT_PERIOD_PRESET, new Date()))
  const { state, reload } = useAsyncData(() => loadAnalytics(range), [range.from, range.to])

  return (
    <section className={styles.page} aria-labelledby="analytics-title">
      <h1 id="analytics-title" className={styles.title}>
        Аналитика
      </h1>
      <PeriodPicker range={range} onChange={setRange} />
      <AsyncContent state={state} onRetry={reload}>
        {data => <AnalyticsDashboard data={data} />}
      </AsyncContent>
    </section>
  )
}
