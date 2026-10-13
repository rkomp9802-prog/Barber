import { isValidUzPhone, validateClientName } from '@barber/shared'
import { useState } from 'react'

import { nextPhoneValue } from '../phoneInput'

type Props = {
  name: string
  phone: string
  onNameChange: (name: string) => void
  onPhoneChange: (phone: string) => void
}

const PHONE_ERROR = 'Введите номер полностью: +998 и 9 цифр'

export function ContactsStep({ name, phone, onNameChange, onPhoneChange }: Props) {
  const [touched, setTouched] = useState({ name: false, phone: false })
  const nameError = touched.name ? validateClientName(name) : undefined
  const phoneError = touched.phone && !isValidUzPhone(phone) ? PHONE_ERROR : undefined

  return (
    <form className="form" onSubmit={event => event.preventDefault()} noValidate>
      <label className="field">
        <span className="field-label">Имя</span>
        <input
          className="input"
          type="text"
          autoComplete="given-name"
          maxLength={60}
          value={name}
          aria-invalid={nameError !== undefined}
          aria-describedby={nameError ? 'name-error' : undefined}
          onChange={event => onNameChange(event.target.value)}
          onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
        />
        {nameError && (
          <span id="name-error" className="field-error" role="alert">
            {nameError}
          </span>
        )}
      </label>
      <label className="field">
        <span className="field-label">Телефон</span>
        <input
          className="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+998 90 123 45 67"
          value={phone}
          aria-invalid={phoneError !== undefined}
          aria-describedby={phoneError ? 'phone-error' : 'phone-hint'}
          onFocus={() => {
            if (phone === '') onPhoneChange('+998 ')
          }}
          onChange={event => onPhoneChange(nextPhoneValue(phone, event.target.value))}
          onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
        />
        {phoneError ? (
          <span id="phone-error" className="field-error" role="alert">
            {phoneError}
          </span>
        ) : (
          <span id="phone-hint" className="field-hint">
            Барбер позвонит, только если что-то изменится.
          </span>
        )}
      </label>
    </form>
  )
}
