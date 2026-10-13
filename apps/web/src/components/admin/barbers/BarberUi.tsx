import type { ReactNode } from 'react'

import type { BarberFieldsForm } from '@/lib/admin/barbersView'

import styles from './barbers.module.css'

export type Notice = { tone: 'ok' | 'error'; text: string }

/** Сообщение о результате действия: ошибка объявляется как alert, успех — как status. */
export function NoticeLine({ notice }: { notice: Notice | null }) {
  if (!notice) return null
  const isError = notice.tone === 'error'
  return (
    <p
      className={`${styles.notice} ${isError ? styles.noticeError : styles.noticeOk}`}
      role={isError ? 'alert' : 'status'}
    >
      {notice.text}
    </p>
  )
}

type PanelProps = {
  id: string
  title: string
  hint?: string
  children: ReactNode
}

/** Карточка блока на странице барбера. */
export function Panel({ id, title, hint, children }: PanelProps) {
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <div className={styles.panelHead}>
        <h2 id={id} className={styles.panelTitle}>
          {title}
        </h2>
        {hint ? <p className={`${styles.hint} muted`}>{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

type FieldsProps = {
  form: BarberFieldsForm
  disabled: boolean
  onPatch: (patch: Partial<BarberFieldsForm>) => void
}

/** Поля профиля барбера; общие для создания и редактирования. */
export function BarberFieldInputs({ form, disabled, onPatch }: FieldsProps) {
  return (
    <div className={styles.fields}>
      <label className={styles.field}>
        <span>Имя</span>
        <input
          className={styles.input}
          value={form.name}
          maxLength={60}
          disabled={disabled}
          required
          onChange={event => onPatch({ name: event.target.value })}
        />
      </label>
      <label className={styles.field}>
        <span>Роль</span>
        <input
          className={styles.input}
          value={form.role}
          maxLength={60}
          placeholder="Барбер"
          disabled={disabled}
          onChange={event => onPatch({ role: event.target.value })}
        />
      </label>
      <label className={`${styles.field} ${styles.fieldWide}`}>
        <span>Био</span>
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          value={form.bio}
          maxLength={1000}
          rows={4}
          disabled={disabled}
          onChange={event => onPatch({ bio: event.target.value })}
        />
      </label>
      <label className={styles.field}>
        <span>Стаж, лет</span>
        <input
          className={styles.input}
          inputMode="numeric"
          value={form.experienceYears}
          disabled={disabled}
          onChange={event => onPatch({ experienceYears: event.target.value })}
        />
      </label>
      <label className={styles.field}>
        <span>Порядок в списке</span>
        <input
          className={styles.input}
          inputMode="numeric"
          value={form.sortOrder}
          disabled={disabled}
          onChange={event => onPatch({ sortOrder: event.target.value })}
        />
      </label>
      <label className={`${styles.checkLabel} ${styles.fieldWide}`}>
        <input
          type="checkbox"
          checked={form.isActive}
          disabled={disabled}
          onChange={event => onPatch({ isActive: event.target.checked })}
        />
        <span>Показывать клиентам (активен)</span>
      </label>
    </div>
  )
}
