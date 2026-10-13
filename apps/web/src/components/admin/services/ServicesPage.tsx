'use client'

import { useState } from 'react'

import type { AdminServiceDto } from '@barber/shared'

import { deleteService, listServices } from '@/lib/admin/catalogApi'
import {
  describeDeleteResult,
  describeServiceError,
  emptyServiceForm,
  nextSortOrder,
  serviceToForm,
  type ServiceFormValues,
} from '@/lib/admin/services'
import { useAsyncData } from '@/lib/admin/useAsyncData'

import { AsyncContent } from '../StateBlocks'
import { ServiceForm } from './ServiceForm'
import { ServicesList } from './ServicesList'
import styles from './services.module.css'

type Editor = { kind: 'create' } | { kind: 'edit'; service: AdminServiceDto }
type Notice = { tone: 'success' | 'warning' | 'error'; text: string }

const NOTICE_CLASS: Readonly<Record<Notice['tone'], string>> = {
  success: styles.noticeSuccess ?? '',
  warning: styles.noticeWarning ?? '',
  error: styles.noticeError ?? '',
}

export function ServicesPage() {
  const { state, reload } = useAsyncData(listServices, [])
  const [editor, setEditor] = useState<Editor | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const services = state.status === 'ready' ? state.data : []

  function openEditor(next: Editor) {
    setNotice(null)
    setEditor(next)
  }

  function handleSaved(name: string) {
    const wasEdit = editor?.kind === 'edit'
    setEditor(null)
    setNotice({ tone: 'success', text: wasEdit ? `Услуга «${name}» сохранена.` : `Услуга «${name}» добавлена.` })
    reload()
  }

  async function handleDelete(service: AdminServiceDto) {
    setBusyId(service.id)
    setNotice(null)
    if (editor?.kind === 'edit' && editor.service.id === service.id) setEditor(null)
    try {
      const result = await deleteService(service.id)
      setNotice(describeDeleteResult(service.name, result))
      reload()
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: describeServiceError(error) })
    } finally {
      setBusyId(null)
    }
  }

  let formInitial: ServiceFormValues | null = null
  if (editor?.kind === 'create') formInitial = emptyServiceForm(nextSortOrder(services))
  if (editor?.kind === 'edit') formInitial = serviceToForm(editor.service)

  return (
    <section className={styles.page} aria-labelledby="services-title">
      <div className={styles.header}>
        <h1 id="services-title" className={styles.title}>
          Услуги
        </h1>
        {editor === null && (
          <button type="button" className="btn btn-primary" onClick={() => openEditor({ kind: 'create' })}>
            Новая услуга
          </button>
        )}
      </div>

      {notice && (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`${styles.notice} ${NOTICE_CLASS[notice.tone]}`}>
          {notice.text}
        </p>
      )}

      {editor !== null && formInitial !== null && (
        <ServiceForm
          key={editor.kind === 'edit' ? editor.service.id : 'create'}
          initial={formInitial}
          serviceId={editor.kind === 'edit' ? editor.service.id : null}
          onSaved={handleSaved}
          onCancel={() => setEditor(null)}
        />
      )}

      <AsyncContent state={state} onRetry={reload}>
        {list => (
          <ServicesList
            services={list}
            busyId={busyId}
            onEdit={service => openEditor({ kind: 'edit', service })}
            onDelete={handleDelete}
          />
        )}
      </AsyncContent>
    </section>
  )
}
