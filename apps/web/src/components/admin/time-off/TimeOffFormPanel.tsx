'use client'

import { useState, type FormEvent } from 'react'

import type { AdminBarberDto, AdminTimeOffDto, AdminTimeOffResultDto } from '@barber/shared'

import { createTimeOff, updateTimeOff } from '@/lib/adminApi'
import {
  TIME_OFF_TYPE_LABELS,
  EMPTY_TIME_OFF_FORM,
  TIME_OFF_TYPE_OPTIONS,
  applyTypeChange,
  timeOffServerErrors,
  timeOffToForm,
  validateTimeOffForm,
  type TimeOffForm,
  type TimeOffFormErrors,
} from '@/lib/admin/timeOff'
import type { AsyncState } from '@/lib/admin/useAsyncData'
import { errorMessage } from '@/lib/apiErrors'
import { isApiRequestError } from '@/lib/api'

import styles from './time-off.module.css'

type Props = {
  barbers: AsyncState<AdminBarberDto[]>
  /** null — создание, иначе редактирование этого исключения. */
  editing: AdminTimeOffDto | null
  onSaved: (result: AdminTimeOffResultDto, editing: boolean) => void
  onCancel: () => void
}

/** Форма создания/изменения исключения. Ошибки сервера выводятся у соответствующих полей. */
export function TimeOffFormPanel({ barbers, editing, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<TimeOffForm>(() => (editing ? timeOffToForm(editing) : EMPTY_TIME_OFF_FORM))
  const [errors, setErrors] = useState<TimeOffFormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const isShopClosed = form.type === 'shop_closed'
  const barberOptions = barbers.status === 'ready' ? barbers.data : []

  function update<K extends keyof TimeOffForm>(key: K, value: TimeOffForm[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { errors: clientErrors, input } = validateTimeOffForm(form)
    setErrors(clientErrors)
    if (!input || submitting) return

    setSubmitting(true)
    try {
      const result = editing
        ? await updateTimeOff(editing.id, input)
        : await createTimeOff(input)
      onSaved(result, editing !== null)
    } catch (error: unknown) {
      const serverErrors = isApiRequestError(error, 'VALIDATION_ERROR') ? timeOffServerErrors(error.details) : {}
      if (Object.keys(serverErrors).length > 0) setErrors(serverErrors)
      else setErrors({ form: errorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (key: keyof TimeOffFormErrors) => errors[key]

  return (
    <section className={styles.formPanel} aria-labelledby="time-off-form-title">
      <h2 id="time-off-form-title" className={styles.subtitle}>
        {editing ? 'Изменить исключение' : 'Новое исключение'}
      </h2>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <label className={styles.field}>
          <span>Тип</span>
          <select
            value={form.type}
            onChange={event => setForm(current => applyTypeChange(current, event.target.value as TimeOffForm['type']))}
          >
            {TIME_OFF_TYPE_OPTIONS.map(type => (
              <option key={type} value={type}>
                {TIME_OFF_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {fieldError('type') ? <small className={styles.fieldError}>{fieldError('type')}</small> : null}
        </label>

        <label className={styles.field}>
          <span>Кого касается</span>
          <select
            value={isShopClosed ? '' : form.barberId}
            disabled={isShopClosed || barbers.status !== 'ready'}
            aria-invalid={fieldError('barberId') ? true : undefined}
            onChange={event => update('barberId', event.target.value)}
          >
            <option value="">Весь салон</option>
            {barberOptions.map(barber => (
              <option key={barber.id} value={barber.id}>
                {barber.name}
                {barber.isActive ? '' : ' (скрыт)'}
              </option>
            ))}
          </select>
          {barbers.status === 'loading' ? <small className="muted">Загружаем барберов…</small> : null}
          {barbers.status === 'error' ? (
            <small className={styles.fieldError}>Не удалось загрузить барберов: {barbers.message}</small>
          ) : null}
          {fieldError('barberId') ? <small className={styles.fieldError}>{fieldError('barberId')}</small> : null}
        </label>

        <label className={styles.field}>
          <span>Начало (Ташкент)</span>
          <input
            type="datetime-local"
            value={form.startsAt}
            aria-invalid={fieldError('startsAt') ? true : undefined}
            onChange={event => update('startsAt', event.target.value)}
          />
          {fieldError('startsAt') ? <small className={styles.fieldError}>{fieldError('startsAt')}</small> : null}
        </label>

        <label className={styles.field}>
          <span>Окончание (Ташкент)</span>
          <input
            type="datetime-local"
            value={form.endsAt}
            aria-invalid={fieldError('endsAt') ? true : undefined}
            onChange={event => update('endsAt', event.target.value)}
          />
          {fieldError('endsAt') ? <small className={styles.fieldError}>{fieldError('endsAt')}</small> : null}
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Комментарий</span>
          <textarea
            rows={2}
            value={form.note}
            aria-invalid={fieldError('note') ? true : undefined}
            onChange={event => update('note', event.target.value)}
          />
          {fieldError('note') ? <small className={styles.fieldError}>{fieldError('note')}</small> : null}
        </label>

        {fieldError('form') ? (
          <p role="alert" className={`${styles.error} ${styles.fieldWide}`}>
            {fieldError('form')}
          </p>
        ) : null}

        <div className={`${styles.formActions} ${styles.fieldWide}`}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </section>
  )
}
