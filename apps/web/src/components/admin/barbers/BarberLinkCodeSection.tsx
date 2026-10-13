'use client'

import { useState } from 'react'

import type { AdminBarberLinkCodeDto } from '@barber/shared'

import { createBarberLinkCode } from '@/lib/adminApi'
import { barberErrorMessage, formatTashkentDateTime } from '@/lib/admin/barbersView'

import { NoticeLine, Panel, type Notice } from './BarberUi'
import styles from './barbers.module.css'

type Props = {
  barberId: string
}

export function BarberLinkCodeSection({ barberId }: Props) {
  const [code, setCode] = useState<AdminBarberLinkCodeDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  async function generate() {
    setBusy(true)
    setNotice(null)
    try {
      setCode(await createBarberLinkCode(barberId))
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: barberErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      id="barber-telegram"
      title="Telegram"
      hint="Код нужен, чтобы барбер получал уведомления о записях в Telegram."
    >
      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={generate}>
          {busy ? 'Создаём код…' : 'Код привязки Telegram'}
        </button>
      </div>
      <NoticeLine notice={notice} />
      {code ? (
        <div className={styles.linkCode} role="status">
          <p>
            Код: <strong className={styles.codeValue}>{code.code}</strong>
          </p>
          <p className="muted">Действует до {formatTashkentDateTime(code.expiresAt)} (по Ташкенту).</p>
          <p>
            <a className={styles.link} href={code.link} target="_blank" rel="noopener noreferrer">
              Открыть ссылку для барбера
            </a>
          </p>
        </div>
      ) : null}
    </Panel>
  )
}
