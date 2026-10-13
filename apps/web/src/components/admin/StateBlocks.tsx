import type { ReactNode } from 'react'

import styles from './Admin.module.css'

export function AdminSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Загрузка">
      <div className={styles.skeletonBar} />
      <div className={styles.skeletonBlock} />
      <div className={styles.skeletonBlock} />
    </div>
  )
}

export function LoadingBlock() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Загрузка">
      <div className={styles.skeletonBlock} />
      <div className={styles.skeletonBlock} />
    </div>
  )
}

type ErrorBlockProps = {
  message: string
  onRetry: () => void
}

export function ErrorBlock({ message, onRetry }: ErrorBlockProps) {
  return (
    <div className={styles.errorBlock} role="alert">
      <p>{message}</p>
      <button type="button" className="btn btn-ghost" onClick={onRetry}>
        Повторить
      </button>
    </div>
  )
}

export function EmptyBlock({ text }: { text: string }) {
  return <p className={`${styles.emptyBlock} muted`}>{text}</p>
}

/** Показывает загрузку, ошибку или содержимое готовых данных. */
type AsyncContentProps<T> = {
  state: { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string }
  onRetry: () => void
  children: (data: T) => ReactNode
}

export function AsyncContent<T>({ state, onRetry, children }: AsyncContentProps<T>) {
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.message} onRetry={onRetry} />
  return <>{children(state.data)}</>
}
