import { BookingCreateForm } from '@/components/admin/bookings/BookingCreateForm'
import bookingsStyles from '@/components/admin/bookings/bookings.module.css'
import editorStyles from '@/components/admin/bookings/bookingEditor.module.css'
import Link from 'next/link'

export default function AdminNewBookingRoute() {
  return (
    <section className={editorStyles.stack} aria-labelledby="new-booking-title">
      <div className={editorStyles.topRow}>
        <Link href="/admin/bookings" className={editorStyles.backLink}>
          ← Все записи
        </Link>
      </div>
      <h1 id="new-booking-title" className={bookingsStyles.title}>
        Новая запись
      </h1>
      <BookingCreateForm />
    </section>
  )
}
