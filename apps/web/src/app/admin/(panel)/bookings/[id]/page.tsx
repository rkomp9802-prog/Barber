import { BookingDetail } from '@/components/admin/bookings/BookingDetail'

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminBookingRoute({ params }: Props) {
  const { id } = await params
  return <BookingDetail bookingId={id} />
}
