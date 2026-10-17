import type { ReactNode } from 'react'

import { errorMessage } from '../errors'
import { Icon } from './Icon'

type SkeletonProps = { rows?: number; variant?: 'row' | 'chip'; label?: string }

export function Skeleton({ rows = 4, variant = 'row', label = 'Загрузка…' }: SkeletonProps) {
  return (
    <div className={`skeleton-list skeleton-${variant}`} role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" aria-hidden="true" />
      ))}
    </div>
  )
}

type ErrorStateProps = { error: unknown; onRetry?: () => void }

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="state state-error" role="alert">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  )
}

type EmptyStateProps = { title: string; children?: ReactNode }

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="state" role="status">
      <p className="state-title">{title}</p>
      {children}
    </div>
  )
}

type NoticeProps = { tone?: 'warning' | 'danger' | 'info'; children: ReactNode; onDismiss?: () => void }

export function Notice({ tone = 'warning', children, onDismiss }: NoticeProps) {
  return (
    <div className={`notice notice-${tone}`} role="alert">
      <span>{children}</span>
      {onDismiss && (
        <button type="button" className="notice-close" aria-label="Скрыть сообщение" onClick={onDismiss}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  )
}
