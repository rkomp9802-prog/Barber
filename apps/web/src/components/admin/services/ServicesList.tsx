import { useState } from 'react'

import { formatDuration, formatPrice, type AdminServiceDto } from '@barber/shared'

import { EmptyBlock } from '../StateBlocks'
import styles from './services.module.css'

type Props = {
  services: readonly AdminServiceDto[]
  /** Услуга, над которой сейчас идёт запрос (удаление). */
  busyId: string | null
  onEdit: (service: AdminServiceDto) => void
  onDelete: (service: AdminServiceDto) => void
}

/** Таблица на широком экране и карточки на узком; данные одни и те же. */
export function ServicesList({ services, busyId, onEdit, onDelete }: Props) {
  // Удаление в два шага: сначала подтверждение в строке, потом запрос.
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (services.length === 0) return <EmptyBlock text="Услуг пока нет. Добавьте первую." />

  const actionsFor = (service: AdminServiceDto) => (
    <ServiceActions
      name={service.name}
      busy={busyId === service.id}
      confirming={confirmId === service.id}
      onEdit={() => onEdit(service)}
      onAskDelete={() => setConfirmId(service.id)}
      onCancelDelete={() => setConfirmId(null)}
      onConfirmDelete={() => {
        setConfirmId(null)
        onDelete(service)
      }}
    />
  )

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Название</th>
              <th scope="col">Длительность</th>
              <th scope="col" className={styles.numeric}>
                Цена
              </th>
              <th scope="col">Статус</th>
              <th scope="col" className={styles.numeric}>
                Порядок
              </th>
              <th scope="col">Действия</th>
            </tr>
          </thead>
          <tbody>
            {services.map(service => (
              <tr key={service.id}>
                <td>
                  <span className={styles.strong}>{service.name}</span>
                  {service.description && <span className={`${styles.subtle} muted`}>{service.description}</span>}
                </td>
                <td className={styles.nowrap}>{formatDuration(service.durationMin)}</td>
                <td className={styles.numeric}>{formatPrice(service.price)}</td>
                <td>
                  <StatusBadge active={service.isActive} />
                </td>
                <td className={styles.numeric}>{service.sortOrder}</td>
                <td>{actionsFor(service)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={styles.cards}>
        {services.map(service => (
          <li key={service.id} className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.strong}>{service.name}</span>
              <StatusBadge active={service.isActive} />
            </div>
            {service.description && <span className="muted">{service.description}</span>}
            <span>
              {formatDuration(service.durationMin)} · {formatPrice(service.price)}
            </span>
            <span className={styles.subtle}>Порядок: {service.sortOrder}</span>
            {actionsFor(service)}
          </li>
        ))}
      </ul>
    </>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`${styles.badge} ${active ? styles.badgeActive : styles.badgeHidden}`}>
      {active ? 'Активна' : 'Скрыта'}
    </span>
  )
}

type ActionsProps = {
  name: string
  busy: boolean
  confirming: boolean
  onEdit: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}

function ServiceActions({
  name,
  busy,
  confirming,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: ActionsProps) {
  if (confirming) {
    return (
      <div className={styles.confirm}>
        <span>Удалить «{name}»? Если услуга была в записях, она будет скрыта.</span>
        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost" onClick={onConfirmDelete}>
            Да, удалить
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancelDelete}>
            Отмена
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className={styles.actions}>
      <button type="button" className="btn btn-ghost" onClick={onEdit} disabled={busy}>
        Изменить
      </button>
      <button type="button" className="btn btn-ghost" onClick={onAskDelete} disabled={busy}>
        {busy ? 'Удаляем…' : 'Удалить'}
      </button>
    </div>
  )
}
