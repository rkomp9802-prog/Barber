import { formatDuration, formatPrice, type ServiceDto } from '@barber/shared'

import { MAX_SERVICES } from '../flow'
import { ChoiceRow } from './ChoiceRow'

type Props = {
  services: readonly ServiceDto[]
  selectedIds: readonly string[]
  onToggle: (serviceId: string) => void
}

export function ServiceStep({ services, selectedIds, onToggle }: Props) {
  const limitReached = selectedIds.length >= MAX_SERVICES
  return (
    <>
      <p className="hint">Можно выбрать несколько услуг — до {MAX_SERVICES}.</p>
      <div className="list" role="group" aria-label="Услуги">
        {services.map(service => {
          const selected = selectedIds.includes(service.id)
          return (
            <ChoiceRow
              key={service.id}
              kind="checkbox"
              selected={selected}
              onSelect={() => {
                if (selected || !limitReached) onToggle(service.id)
              }}
              title={service.name}
              subtitle={service.description}
              meta={
                <>
                  <span className="price">{formatPrice(service.price)}</span>
                  <span className="muted">{formatDuration(service.durationMin)}</span>
                </>
              }
            />
          )
        })}
      </div>
    </>
  )
}
