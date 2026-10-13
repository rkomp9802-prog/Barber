'use client'

import { useState } from 'react'

import type { AdminTimeOffDto, AdminTimeOffResultDto } from '@barber/shared'

import { deleteTimeOff, listBarbers, listTimeOff } from '@/lib/adminApi'
import {
  EMPTY_TIME_OFF_FILTERS,
  buildTimeOffQuery,
  validateTimeOffFilters,
  type TimeOffFilters,
} from '@/lib/admin/timeOff'
import { useAsyncData } from '@/lib/admin/useAsyncData'
import { errorMessage } from '@/lib/apiErrors'

import { AsyncContent } from '../StateBlocks'
import { ConflictNotice } from './ConflictNotice'
import { TimeOffFilterForm } from './TimeOffFilterForm'
import { TimeOffFormPanel } from './TimeOffFormPanel'
import { TimeOffList } from './TimeOffList'
import styles from './time-off.module.css'

type Panel = { mode: 'create' } | { mode: 'edit'; item: AdminTimeOffDto }

export function TimeOffPage() {
  const [filters, setFilters] = useState<TimeOffFilters>(EMPTY_TIME_OFF_FILTERS)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [lastResult, setLastResult] = useState<AdminTimeOffResultDto | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const rangeError = validateTimeOffFilters(filters)
  const barbers = useAsyncData(listBarbers, [])
  // При неверном периоде запрос не отправляем: показываем подсказку вместо списка.
  const list = useAsyncData(
    () => (rangeError ? Promise.resolve<AdminTimeOffDto[]>([]) : listTimeOff(buildTimeOffQuery(filters))),
    [filters, rangeError],
  )

  function clearMessages() {
    setMessage(null)
    setActionError(null)
  }

  function handleSaved(result: AdminTimeOffResultDto, editing: boolean) {
    setPanel(null)
    setLastResult(result)
    setMessage(editing ? 'Исключение обновлено' : 'Исключение добавлено')
    list.reload()
  }

  async function handleDelete(item: AdminTimeOffDto) {
    clearMessages()
    setLastResult(null)
    setDeletingId(item.id)
    try {
      await deleteTimeOff(item.id)
      setMessage('Исключение удалено')
      list.reload()
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  const emptyText = rangeError ? '' : 'Исключений по этим фильтрам нет.'

  return (
    <section className={styles.page} aria-labelledby="time-off-title">
      <div className={styles.header}>
        <h1 id="time-off-title" className={styles.title}>
          Исключения
        </h1>
        <button
          type="button"
          className="btn btn-primary"
          disabled={panel?.mode === 'create'}
          onClick={() => {
            clearMessages()
            setPanel({ mode: 'create' })
          }}
        >
          Добавить исключение
        </button>
      </div>

      {message ? (
        <p role="status" className={styles.success}>
          {message}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className={styles.error}>
          {actionError}
        </p>
      ) : null}
      {lastResult && lastResult.conflicts.length > 0 ? (
        <ConflictNotice result={lastResult} onDismiss={() => setLastResult(null)} />
      ) : null}

      {panel ? (
        <TimeOffFormPanel
          key={panel.mode === 'edit' ? panel.item.id : 'create'}
          barbers={barbers.state}
          editing={panel.mode === 'edit' ? panel.item : null}
          onSaved={handleSaved}
          onCancel={() => setPanel(null)}
        />
      ) : null}

      <TimeOffFilterForm filters={filters} onChange={setFilters} barbers={barbers.state} />

      {rangeError ? (
        <p role="alert" className={styles.error}>
          {rangeError}
        </p>
      ) : (
        <AsyncContent state={list.state} onRetry={list.reload}>
          {items => (
            <TimeOffList
              items={items}
              emptyText={emptyText}
              deletingId={deletingId}
              onEdit={item => {
                clearMessages()
                setPanel({ mode: 'edit', item })
              }}
              onDelete={handleDelete}
            />
          )}
        </AsyncContent>
      )}
    </section>
  )
}
