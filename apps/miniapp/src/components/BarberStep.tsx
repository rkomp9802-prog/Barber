import { ANY_BARBER, type BarberDto, plural } from '@barber/shared'

import { ChoiceRow } from './ChoiceRow'
import { EmptyState } from './Status'

type Props = {
  barbers: readonly BarberDto[]
  selectedId: string | null
  onSelect: (barberId: string) => void
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
}

function Avatar({ barber }: { barber: BarberDto }) {
  if (barber.photoUrl) {
    return <img className="avatar" src={barber.photoUrl} alt="" loading="lazy" />
  }
  return (
    <span className="avatar avatar-initials" aria-hidden="true">
      {initials(barber.name)}
    </span>
  )
}

function ratingText(barber: BarberDto): string {
  if (barber.reviewsCount === 0) return 'Пока без отзывов'
  const reviews = plural(barber.reviewsCount, ['отзыв', 'отзыва', 'отзывов'])
  return `★ ${barber.rating.toFixed(1)} · ${barber.reviewsCount} ${reviews}`
}

export function BarberStep({ barbers, selectedId, onSelect }: Props) {
  return (
    <div className="list" role="radiogroup" aria-label="Барбер">
      <ChoiceRow
        kind="radio"
        selected={selectedId === ANY_BARBER}
        onSelect={() => onSelect(ANY_BARBER)}
        leading={
          <span className="avatar avatar-any" aria-hidden="true">
            ✂
          </span>
        }
        title="Любой свободный"
        subtitle="Покажем больше свободного времени"
      />
      {barbers.map(barber => (
        <ChoiceRow
          key={barber.id}
          kind="radio"
          selected={selectedId === barber.id}
          onSelect={() => onSelect(barber.id)}
          leading={<Avatar barber={barber} />}
          title={barber.name}
          subtitle={`${barber.role} · ${ratingText(barber)}`}
        />
      ))}
      {barbers.length === 0 && (
        <EmptyState title="Нет барбера, который делает все выбранные услуги сразу">
          <p className="muted">Выберите «Любой свободный» или измените набор услуг.</p>
        </EmptyState>
      )}
    </div>
  )
}
