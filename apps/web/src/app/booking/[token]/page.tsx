import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { tashkentDateKey, type BookingDto } from '@barber/shared'

import { LoadError } from '@/components/manage/LoadError'
import { ManageBooking } from '@/components/manage/ManageBooking'
import { Header } from '@/components/landing/Header'
import { getBooking, isApiRequestError } from '@/lib/api'
import { errorMessage } from '@/lib/apiErrors'
import { warnOnce } from '@/lib/serverLogger'

/* Ссылка с токеном персональная: в поисковую выдачу не нужна. */
export const metadata: Metadata = {
  title: 'Ваша запись',
  robots: { index: false },
}

type Props = {
  params: Promise<{ token: string }>
}

type LoadResult = { kind: 'ok'; booking: BookingDto } | { kind: 'notFound' } | { kind: 'error'; message: string }

/** Токен не пишем в лог: в сообщении остаётся только код ошибки API. */
async function loadBooking(token: string): Promise<LoadResult> {
  try {
    return { kind: 'ok', booking: await getBooking(token, { cache: 'no-store' }) }
  } catch (error: unknown) {
    if (isApiRequestError(error, 'NOT_FOUND')) return { kind: 'notFound' }
    warnOnce('booking-manage-load', 'Не удалось загрузить запись клиента', error)
    return { kind: 'error', message: errorMessage(error) }
  }
}

export default async function ManageBookingPage({ params }: Props) {
  const { token } = await params
  const result = await loadBooking(token)
  if (result.kind === 'notFound') notFound()

  return (
    <>
      <Header showCta={false} />
      <main className="container">
        {result.kind === 'ok' ? (
          <ManageBooking initialBooking={result.booking} todayKey={tashkentDateKey(new Date())} />
        ) : (
          <LoadError message={result.message} />
        )}
      </main>
    </>
  )
}
