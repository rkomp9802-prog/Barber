import {
  ANY_BARBER,
  type BarberDto,
  formatDuration,
  formatLongDate,
  formatPrice,
  type ServiceDto,
  type SlotDto,
  totalDurationMin,
  totalPrice,
} from '@barber/shared'

import { Notice } from './Status'
import { SummaryList } from './SummaryList'

type Props = {
  services: readonly ServiceDto[]
  barbers: readonly BarberDto[]
  barberId: string
  date: string
  slot: SlotDto
  name: string
  phone: string
  error: string | null
}

export function barberLabel(barbers: readonly BarberDto[], barberId: string, slot: SlotDto | null): string {
  const id = barberId === ANY_BARBER && slot?.barberIds.length === 1 ? slot.barberIds[0] : barberId
  if (id === ANY_BARBER) return 'Любой свободный'
  return barbers.find(barber => barber.id === id)?.name ?? 'Любой свободный'
}

export function ConfirmStep({ services, barbers, barberId, date, slot, name, phone, error }: Props) {
  const items = [
    { label: 'Услуги', value: services.map(service => service.name).join(', ') },
    { label: 'Барбер', value: barberLabel(barbers, barberId, slot) },
    { label: 'Когда', value: `${formatLongDate(date)}, ${slot.time}` },
    { label: 'Длительность', value: formatDuration(totalDurationMin(services)) },
    { label: 'Стоимость', value: <strong>{formatPrice(totalPrice(services))}</strong> },
    { label: 'Имя', value: name.trim() },
    { label: 'Телефон', value: phone },
  ]
  return (
    <>
      {error && <Notice tone="danger">{error}</Notice>}
      <SummaryList items={items} />
      <p className="hint">Оплата на месте. Отменить или перенести запись можно в разделе «Мои записи».</p>
    </>
  )
}
