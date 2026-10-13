'use client'

import { useState } from 'react'

import type { AdminTimeOffDto } from '@barber/shared'

import { TIME_OFF_TYPE_LABELS, describeTimeOffPeriod, timeOffScopeLabel } from '@/lib/admin/timeOff'

import { EmptyBlock } from '../StateBlocks'
import styles from './time-off.module.css'

type Props = {
  items: readonly AdminTimeOffDto[]
  emptyText: string
  deletingId: string | null
  onEdit: (item: AdminTimeOffDto) => void
  onDelete: (item: AdminTimeOffDto) => void
}

/** Список исключений: на широком экране строки, на узком — карточки (одна разметка). */
export function TimeOffList({ items, emptyText, deletingId, onEdit, onDelete }: Props) {
  // Удаление в два шага: первое нажатие просит подтверждения.
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (items.length === 0) return <EmptyBlock text={emptyText} />

  return (
    <ul className={styles.list} aria-label="Список исключений">
      {items.map(item => {
        const busy = deletingId === item.id
        const confirming = confirmId === item.id
        return (
          <li key={item.id} className={styles.item}>
            <div className={styles.itemMain}>
              <span className={styles.typeBadge}>{TIME_OFF_TYPE_LABELS[item.type]}</span>
              <span className={styles.strong}>{timeOffScopeLabel(item)}</span>
              <span className={styles.period}>{describeTimeOffPeriod(item)}</span>
              {item.note ? <span className={styles.note}>{item.note}</span> : null}
            </div>
            <div className={styles.itemActions}>
              <button type="button" className="btn btn-ghost" onClick={() => onEdit(item)} disabled={busy}>
                Изменить
              </button>
              {confirming ? (
                <>
                  <button
                    type="button"
                    className={`btn ${styles.dangerButton}`}
                    disabled={busy}
                    onClick={() => {
                      setConfirmId(null)
                      onDelete(item)
                    }}
                  >
                    {busy ? 'Удаляем…' : 'Точно удалить'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmId(null)} disabled={busy}>
                    Не удалять
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={`btn btn-ghost ${styles.dangerText}`}
                  disabled={busy}
                  onClick={() => setConfirmId(item.id)}
                >
                  Удалить
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
