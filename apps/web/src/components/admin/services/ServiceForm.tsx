'use client'

import { useId, useState, type FormEvent, type ReactNode } from 'react'

import { createService, updateService } from '@/lib/admin/catalogApi'
import {
  SERVICE_DESCRIPTION_MAX,
  SERVICE_NAME_MAX,
  SERVICE_PRICE_MAX,
  SERVICE_SORT_MAX,
  describeServiceError,
  toServiceInput,
  validateServiceForm,
  type ServiceFormErrors,
  type ServiceFormField,
  type ServiceFormValues,
} from '@/lib/admin/services'

import styles from './services.module.css'

type Props = {
  initial: ServiceFormValues
  /** null — создание новой услуги. */
  serviceId: string | null
  onSaved: (name: string) => void
  onCancel: () => void
}

export function ServiceForm({ initial, serviceId, onSaved, onCancel }: Props) {
  const idPrefix = useId()
  const [values, setValues] = useState<ServiceFormValues>(initial)
  const [errors, setErrors] = useState<ServiceFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update<K extends ServiceFormField>(key: K, value: ServiceFormValues[K]) {
    setValues(current => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const found = validateServiceForm(values)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return

    const input = toServiceInput(values)
    setSaving(true)
    try {
      const saved = serviceId === null ? await createService(input) : await updateService(serviceId, input)
      onSaved(saved.name)
    } catch (error: unknown) {
      setFormError(describeServiceError(error))
    } finally {
      setSaving(false)
    }
  }

  const id = (field: ServiceFormField) => `${idPrefix}-${field}`
  const errorId = (field: ServiceFormField) => `${idPrefix}-${field}-error`

  function renderField(field: ServiceFormField, label: string, control: ReactNode, wide = false) {
    const message = errors[field]
    return (
      <label className={`${styles.field} ${wide ? styles.fieldWide : ''}`} htmlFor={id(field)}>
        <span>{label}</span>
        {control}
        {message && (
          <span id={errorId(field)} className={styles.fieldError}>
            {message}
          </span>
        )}
      </label>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-labelledby={`${idPrefix}-title`}>
      <h2 id={`${idPrefix}-title`} className={styles.formTitle}>
        {serviceId === null ? 'Новая услуга' : 'Редактирование услуги'}
      </h2>

      {renderField(
        'name',
        'Название',
        <input
          id={id('name')}
          type="text"
          maxLength={SERVICE_NAME_MAX + 20}
          value={values.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? errorId('name') : undefined}
          onChange={event => update('name', event.target.value)}
        />,
        true,
      )}

      {renderField(
        'description',
        'Описание (необязательно)',
        <textarea
          id={id('description')}
          rows={3}
          maxLength={SERVICE_DESCRIPTION_MAX + 100}
          value={values.description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? errorId('description') : undefined}
          onChange={event => update('description', event.target.value)}
        />,
        true,
      )}

      {renderField(
        'durationMin',
        'Длительность, минут',
        <input
          id={id('durationMin')}
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          step={1}
          value={values.durationMin}
          aria-invalid={errors.durationMin ? true : undefined}
          aria-describedby={errors.durationMin ? errorId('durationMin') : undefined}
          onChange={event => update('durationMin', event.target.value)}
        />,
      )}

      {renderField(
        'price',
        'Цена, сум',
        <input
          id={id('price')}
          type="text"
          inputMode="numeric"
          maxLength={String(SERVICE_PRICE_MAX).length + 4}
          value={values.price}
          aria-invalid={errors.price ? true : undefined}
          aria-describedby={errors.price ? errorId('price') : undefined}
          onChange={event => update('price', event.target.value)}
        />,
      )}

      {renderField(
        'sortOrder',
        `Порядок (0–${SERVICE_SORT_MAX})`,
        <input
          id={id('sortOrder')}
          type="number"
          inputMode="numeric"
          min={0}
          max={SERVICE_SORT_MAX}
          step={1}
          value={values.sortOrder}
          aria-invalid={errors.sortOrder ? true : undefined}
          aria-describedby={errors.sortOrder ? errorId('sortOrder') : undefined}
          onChange={event => update('sortOrder', event.target.value)}
        />,
      )}

      <label className={styles.checkbox}>
        <input type="checkbox" checked={values.isActive} onChange={event => update('isActive', event.target.checked)} />
        <span>Активна: показывать клиентам при записи</span>
      </label>

      {formError && (
        <p role="alert" className={styles.formError}>
          {formError}
        </p>
      )}

      <div className={styles.formActions}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
