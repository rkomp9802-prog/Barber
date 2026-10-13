import { useState, type FormEvent, type ReactNode } from 'react'

import { isValidUzPhone, uzLocalDigits, validateClientName } from '@barber/shared'

import styles from './Form.module.css'

type Props = {
  formId: string
  name: string
  phone: string
  onNameChange: (name: string) => void
  onPhoneChange: (phone: string) => void
  onSubmit: () => void
}

type Touched = { name: boolean; phone: boolean }

function phoneError(phone: string): string | undefined {
  if (uzLocalDigits(phone).length === 0) return 'Введите номер телефона'
  if (!isValidUzPhone(phone)) return 'Номер должен быть в формате +998 90 123 45 67'
  return undefined
}

type FieldProps = {
  id: string
  label: string
  hint: string
  error: string | undefined
  children: (describedBy: string) => ReactNode
}

function Field({ id, label, hint, error, children }: FieldProps) {
  const messageId = `${id}-message`
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(messageId)}
      <p id={messageId} className={error ? styles.fieldError : styles.fieldHint}>
        {error ?? hint}
      </p>
    </div>
  )
}

/** Форма контактов: ошибки показываем после ухода из поля или попытки отправки. */
export function ContactsStep({ formId, name, phone, onNameChange, onPhoneChange, onSubmit }: Props) {
  const [touched, setTouched] = useState<Touched>({ name: false, phone: false })
  const nameError = touched.name ? validateClientName(name) : undefined
  const phoneErr = touched.phone ? phoneError(phone) : undefined

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched({ name: true, phone: true })
    if (validateClientName(name) === undefined && isValidUzPhone(phone)) onSubmit()
  }

  return (
    <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
      <Field id="client-name" label="Имя" hint="Так к вам обратится мастер" error={nameError}>
        {describedBy => (
          <input
            id="client-name"
            className={styles.input}
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            value={name}
            onChange={event => onNameChange(event.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
            aria-invalid={nameError !== undefined}
            aria-describedby={describedBy}
          />
        )}
      </Field>
      <Field id="client-phone" label="Телефон" hint="Позвоним, только если что-то изменится" error={phoneErr}>
        {describedBy => (
          <input
            id="client-phone"
            className={styles.input}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="done"
            placeholder="+998 90 123 45 67"
            value={phone}
            onChange={event => onPhoneChange(event.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
            aria-invalid={phoneErr !== undefined}
            aria-describedby={describedBy}
          />
        )}
      </Field>
    </form>
  )
}
