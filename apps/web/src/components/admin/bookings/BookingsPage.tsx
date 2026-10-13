'use client'

import { useState } from 'react'

import type { BookingTab } from '@/lib/admin/bookingsQuery'

import { AllBookings } from './AllBookings'
import { TodayBookings } from './TodayBookings'
import styles from './bookings.module.css'

const TABS: readonly { value: BookingTab; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'all', label: 'Все' },
]

export function BookingsPage() {
  const [tab, setTab] = useState<BookingTab>('today')

  return (
    <section className={styles.page} aria-labelledby="bookings-title">
      <h1 id="bookings-title" className={styles.title}>
        Записи
      </h1>
      <div className={styles.tabs} role="tablist" aria-label="Период записей">
        {TABS.map(item => {
          const selected = item.value === tab
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`${styles.tab} ${selected ? styles.tabActive : ''}`}
              onClick={() => setTab(item.value)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {tab === 'today' ? <TodayBookings /> : <AllBookings />}
    </section>
  )
}
