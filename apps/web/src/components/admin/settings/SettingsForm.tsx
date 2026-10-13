'use client'

import { useId, useState, type FormEvent } from 'react'

import type { AdminSettingsDto, AdminSettingsInput } from '@barber/shared'

import { isApiRequestError } from '@/lib/api'
import { updateSettings } from '@/lib/adminApi'
import { errorMessage } from '@/lib/apiErrors'
import {
  SETTING_FIELDS,
  changedSettingKeys,
  settingsServerErrors,
  settingsToForm,
  validateSettingsForm,
  type SettingKey,
  type SettingsFormErrors,
  type SettingsFormValues,
} from '@/lib/admin/settings'

import styles from './settings.module.css'

type Props = {
  initial: AdminSettingsDto
}

/** Форма всех настроек. PUT отправляет только изменённые ключи; ошибки 422 выводятся у полей. */
export function SettingsForm({ initial }: Props) {
  const idPrefix = useId()
  const [saved, setSaved] = useState<AdminSettingsDto>(initial)
  const [values, setValues] = useState<SettingsFormValues>(() => settingsToForm(initial))
  const [errors, setErrors] = useState<SettingsFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function changeValue(key: SettingKey, value: string) {
    setValues(current => ({ ...current, [key]: value }))
    // Ошибка поля снимается, как только его правят.
    setErrors(({ [key]: _removed, ...rest }) => rest)
    setMessage(null)
  }

  function reset() {
    setValues(settingsToForm(saved))
    setErrors({})
    setMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setMessage(null)

    const { errors: clientErrors, input } = validateSettingsForm(values)
    setErrors(clientErrors)
    if (!input) return

    const changed = changedSettingKeys(saved, values)
    if (changed.length === 0) {
      setMessage('Изменений нет')
      return
    }
    const patch = Object.fromEntries(changed.map(key => [key, input[key]])) as AdminSettingsInput

    setSubmitting(true)
    try {
      const result = await updateSettings(patch)
      setSaved(result)
      setValues(settingsToForm(result))
      setMessage('Настройки сохранены')
    } catch (error: unknown) {
      const serverErrors = isApiRequestError(error, 'VALIDATION_ERROR') ? settingsServerErrors(error.details) : {}
      setErrors(Object.keys(serverErrors).length > 0 ? serverErrors : { form: errorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-label="Настройки салона">
      {errors.form ? (
        <p role="alert" className={styles.error}>
          {errors.form}
        </p>
      ) : null}
      {message ? (
        <p role="status" className={styles.success}>
          {message}
        </p>
      ) : null}

      <div className={styles.fields}>
        {SETTING_FIELDS.map(field => {
          const inputId = `${idPrefix}-${field.key}`
          const helpId = `${inputId}-help`
          const errorId = `${inputId}-error`
          const error = errors[field.key]
          const describedBy = error ? `${helpId} ${errorId}` : helpId

          return (
            <div key={field.key} className={styles.field}>
              <label htmlFor={inputId} className={styles.label}>
                {field.label}
              </label>
              {field.readOnly ? (
                // Только текст: поле не редактируется и в PUT не отправляется.
                <output id={inputId} aria-describedby={helpId}>
                  {values[field.key]}
                </output>
              ) : (
                <input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  value={values[field.key]}
                  disabled={submitting}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy}
                  onChange={event => changeValue(field.key, event.target.value)}
                />
              )}
              <small id={helpId} className={styles.help}>
                {field.help}
              </small>
              {error ? (
                <small id={errorId} className={styles.fieldError}>
                  {error}
                </small>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={submitting}>
          Вернуть сохранённые
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
