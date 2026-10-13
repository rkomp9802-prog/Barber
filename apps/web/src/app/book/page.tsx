import type { Metadata } from 'next'

import { ANY_BARBER, tashkentDateKey, type BarberChoice } from '@barber/shared'

import { BookingWizard } from '@/components/booking/BookingWizard'
import type { InitialSelection } from '@/components/booking/bookingState'
import type { SourceMode } from '@/components/booking/bookingSource'
import type { BookingCatalog } from '@/components/booking/types'
import { Header } from '@/components/landing/Header'
import { shop } from '@/data/shop'
import { loadCatalog } from '@/lib/catalog'

export const metadata: Metadata = {
  title: `Онлайн-запись — ${shop.fullName}`,
  description: 'Выберите услугу, барбера, дату и время. Запись занимает меньше минуты.',
}

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Параметры ссылки приходят от пользователя: берём только то, что есть в каталоге. */
function parseSelection(params: SearchParams, catalog: BookingCatalog): InitialSelection {
  const serviceParam = firstParam(params.service)
  const barberParam = firstParam(params.barber)
  const serviceId = catalog.services.some(service => service.id === serviceParam) ? serviceParam : undefined
  const isKnownBarber = barberParam !== undefined && catalog.barbers.some(barber => barber.id === barberParam)
  const barber: BarberChoice | undefined = barberParam === ANY_BARBER || isKnownBarber ? barberParam : undefined
  return { serviceId, barber }
}

export default async function BookPage({ searchParams }: Props) {
  const params = await searchParams
  const catalog = await loadCatalog()
  const mode: SourceMode = catalog.source === 'api' ? 'live' : 'demo'

  return (
    <>
      <Header showCta={false} />
      <main className="container">
        <BookingWizard
          initialSelection={parseSelection(params, catalog)}
          catalog={catalog}
          mode={mode}
          todayKey={tashkentDateKey(new Date())}
          isDemoError={firstParam(params.demo) === 'error'}
        />
      </main>
    </>
  )
}
