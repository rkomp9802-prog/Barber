'use client'

import { listTodayBookings } from '@/lib/adminApi'
import { useAsyncData } from '@/lib/admin/useAsyncData'

import { AsyncContent } from '../StateBlocks'
import { BookingsList } from './BookingsList'

export function TodayBookings() {
  const { state, reload } = useAsyncData(listTodayBookings, [])

  return (
    <AsyncContent state={state} onRetry={reload}>
      {bookings => <BookingsList bookings={bookings} emptyText="На сегодня записей нет." />}
    </AsyncContent>
  )
}
