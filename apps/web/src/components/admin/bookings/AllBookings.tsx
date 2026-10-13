'use client'

import { useState } from 'react'

import { listBookings } from '@/lib/adminApi'
import {
  EMPTY_BOOKING_FILTERS,
  buildBookingsQuery,
  hasActiveBookingFilters,
  type BookingFilters,
} from '@/lib/admin/bookingsQuery'
import { useAsyncData } from '@/lib/admin/useAsyncData'

import { AsyncContent } from '../StateBlocks'
import { Pagination } from '../Pagination'
import { BookingFilterForm } from './BookingFilterForm'
import { BookingsList } from './BookingsList'
import styles from './bookings.module.css'

export function AllBookings() {
  const [filters, setFilters] = useState<BookingFilters>(EMPTY_BOOKING_FILTERS)
  const [page, setPage] = useState(1)
  const { state, reload } = useAsyncData(() => listBookings(buildBookingsQuery(filters, page)), [filters, page])

  function changeFilters(next: BookingFilters) {
    setFilters(next)
    setPage(1)
  }

  const emptyText = hasActiveBookingFilters(filters)
    ? 'По этим фильтрам записей нет.'
    : 'Записей пока нет.'

  return (
    <div className={styles.allBookings}>
      <BookingFilterForm filters={filters} onChange={changeFilters} />
      <AsyncContent state={state} onRetry={reload}>
        {result => (
          <>
            <BookingsList bookings={result.items} emptyText={emptyText} />
            <Pagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              onPageChange={setPage}
            />
          </>
        )}
      </AsyncContent>
    </div>
  )
}
