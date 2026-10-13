'use client'

import { useState, type FormEvent } from 'react'

import { useRouter } from 'next/navigation'

import { login } from '@/lib/adminApi'
import { loginErrorMessage } from '@/lib/admin/loginErrors'

import styles from './Admin.module.css'

type Props = {
  /** Уже проверенный внутренний путь админки (см. sanitizeNextPath). */
  nextPath: string
}

export function LoginForm({ nextPath }: Props) {
  const router = useRouter()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !pending && loginValue.trim() !== '' && password !== ''

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setPending(true)
    setError(null)
    try {
      await login({ login: loginValue.trim(), password })
      router.replace(nextPath)
    } catch (submitError: unknown) {
      setError(loginErrorMessage(submitError))
      setPending(false)
    }
  }

  return (
    <form className={styles.loginForm} onSubmit={handleSubmit} noValidate>
      <label className={styles.field}>
        <span>Логин</span>
        <input
          name="login"
          autoComplete="username"
          value={loginValue}
          onChange={event => setLoginValue(event.target.value)}
          required
        />
      </label>
      <label className={styles.field}>
        <span>Пароль</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? (
        <p role="alert" className={styles.inlineError}>
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit}>
        {pending ? 'Входим…' : 'Войти'}
      </button>
    </form>
  )
}
