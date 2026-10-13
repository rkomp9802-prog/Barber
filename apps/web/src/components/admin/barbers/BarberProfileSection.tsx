'use client'

import { useState, type FormEvent } from 'react'

import type { AdminBarberDto } from '@barber/shared'

import { updateBarber } from '@/lib/adminApi'
import {
  barberErrorMessage,
  profileToForm,
  validateBarberFields,
  type BarberFieldsForm,
} from '@/lib/admin/barbersView'

import { BarberFieldInputs, NoticeLine, Panel, type Notice } from './BarberUi'
import styles from './barbers.module.css'

type Props = {
  barber: AdminBarberDto
  onChange: (barber: AdminBarberDto) => void
}

export function BarberProfileSection({ barber, onChange }: Props) {
  const [form, setForm] = useState<BarberFieldsForm>(() => profileToForm(barber))
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
      const updated = await updateBarber(barber.id, checked.value)
      onChange(updated)
      setForm(profileToForm(updated))
      setNotice({ tone: 'ok', text: 'Профиль сохранён.' })
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: barberErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel id="barber-profile" title="Профиль">
      <form className={styles.form} onSubmit={handleSubmit}>
        <BarberFieldInputs form={form} disabled={saving} onPatch={patch} />
        <NoticeLine notice={notice} />
        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить профиль'}
          </button>
        </div>
      </form>
    </Panel>
  )
}
