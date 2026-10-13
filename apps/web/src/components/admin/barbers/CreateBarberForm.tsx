'use client'

import { useState, type FormEvent } from 'react'

import type { AdminBarberDto } from '@barber/shared'

import { createBarber } from '@/lib/adminApi'
import {
  barberErrorMessage,
  emptyCreateForm,
  validateBarberFields,
  type BarberFieldsForm,
} from '@/lib/admin/barbersView'

import { BarberFieldInputs, NoticeLine, type Notice } from './BarberUi'
import styles from './barbers.module.css'

type Props = {
  onCreated: (barber: AdminBarberDto) => void
  onCancel: () => void
}

export function CreateBarberForm({ onCreated, onCancel }: Props) {
  const [form, setForm] = useState<BarberFieldsForm>(emptyCreateForm)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  function patch(next: Partial<BarberFieldsForm>) {
    setForm(current => ({ ...current, ...next }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const checked = validateBarberFields(form)
    if (!checked.ok) {
      setNotice({ tone: 'error', text: checked.error })
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const barber = await createBarber(checked.value)
      onCreated(barber)
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: barberErrorMessage(error) })
      setSaving(false)
    }
  }

  return (
    <form className={styles.panel} onSubmit={handleSubmit} aria-label="Новый барбер">
      <h2 className={styles.panelTitle}>Новый барбер</h2>
      <BarberFieldInputs form={form} disabled={saving} onPatch={patch} />
      <p className={`${styles.hint} muted`}>Фото, услуги и график настраиваются после создания.</p>
      <NoticeLine notice={notice} />
      <div className={styles.actions}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Создаём…' : 'Создать барбера'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={saving} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
