'use client'

import { useState, type FormEvent } from 'react'

import type { AdminBarberDto, AdminServiceDto } from '@barber/shared'
import { formatDuration, formatPrice } from '@barber/shared'

import { setBarberServices } from '@/lib/adminApi'
import {
  barberErrorMessage,
  buildServiceRows,
  validateServiceRows,
  type ServiceRowForm,
} from '@/lib/admin/barbersView'

import { EmptyBlock } from '../StateBlocks'
import { NoticeLine, Panel, type Notice } from './BarberUi'
import styles from './barbers.module.css'

type Props = {
  barber: AdminBarberDto
  catalog: AdminServiceDto[]
  onChange: (barber: AdminBarberDto) => void
}

export function BarberServicesSection({ barber, catalog, onChange }: Props) {
  const [rows, setRows] = useState<ServiceRowForm[]>(() => buildServiceRows(catalog, barber.services))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  function patchRow(serviceId: string, patch: Partial<ServiceRowForm>) {
    setRows(current => current.map(row => (row.serviceId === serviceId ? { ...row, ...patch } : row)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const checked = validateServiceRows(rows)
    if (!checked.ok) {
      setNotice({ tone: 'error', text: checked.error })
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const updated = await setBarberServices(barber.id, checked.value)
      onChange(updated)
      setRows(buildServiceRows(catalog, updated.services))
      setNotice({ tone: 'ok', text: 'Услуги сохранены.' })
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: barberErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      id="barber-services"
      title="Услуги"
      hint="Пустые цена и длительность берутся из услуги. Заполните поле, чтобы задать свои."
    >
      {catalog.length === 0 ? (
        <EmptyBlock text="В каталоге нет услуг. Сначала добавьте услуги." />
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <ul className={styles.serviceList}>
            {rows.map(row => {
              const service = catalog.find(item => item.id === row.serviceId)
              return (
                <li key={row.serviceId} className={styles.serviceRow}>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={row.isEnabled}
                      disabled={saving}
                      onChange={event => patchRow(row.serviceId, { isEnabled: event.target.checked })}
                    />
                    <span>
                      <span className={styles.strong}>{row.name}</span>
                      {service && !service.isActive ? <span className="muted"> (скрыта в каталоге)</span> : null}
                      {service ? (
                        <span className={`${styles.subtle} muted`}>
                          по умолчанию {formatDuration(service.durationMin)}, {formatPrice(service.price)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <label className={styles.field}>
                    <span>Длительность, мин</span>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      placeholder={service ? String(service.durationMin) : ''}
                      value={row.durationMin}
                      disabled={saving}
                      onChange={event => patchRow(row.serviceId, { durationMin: event.target.value })}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Цена, сум</span>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      placeholder={service ? String(service.price) : ''}
                      value={row.price}
                      disabled={saving}
                      onChange={event => patchRow(row.serviceId, { price: event.target.value })}
                    />
                  </label>
                </li>
              )
            })}
          </ul>
          <NoticeLine notice={notice} />
          <div className={styles.actions}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить услуги'}
            </button>
          </div>
        </form>
      )}
    </Panel>
  )
}
