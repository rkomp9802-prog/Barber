'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { AdminBarberDto } from '@barber/shared'

import { deleteBarber, listBarbers } from '@/lib/adminApi'
import { barberErrorMessage, deleteResultMessage, telegramLabel } from '@/lib/admin/barbersView'
import { useAsyncData } from '@/lib/admin/useAsyncData'

import { AsyncContent, EmptyBlock } from '../StateBlocks'
import { CreateBarberForm } from './CreateBarberForm'
import { NoticeLine, type Notice } from './BarberUi'
import styles from './barbers.module.css'

export function BarbersPage() {
  const router = useRouter()
  const { state, reload } = useAsyncData(listBarbers, [])
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function remove(barber: AdminBarberDto) {
    const confirmed = window.confirm(
      `Удалить барбера «${barber.name}»? Если у него есть записи, он будет скрыт, а не удалён.`,
    )
    if (!confirmed) return
    setBusyId(barber.id)
    setNotice(null)
    try {
      const result = await deleteBarber(barber.id)
      setNotice({ tone: 'ok', text: deleteResultMessage(result, barber.name) })
      reload()
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: barberErrorMessage(error) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className={styles.page} aria-labelledby="barbers-title">
      <div className={styles.titleRow}>
        <h1 id="barbers-title" className={styles.title}>
          Барберы
        </h1>
        <button
          type="button"
          className="btn btn-primary"
          aria-expanded={creating}
          onClick={() => setCreating(open => !open)}
        >
          {creating ? 'Скрыть форму' : 'Добавить барбера'}
        </button>
      </div>

      {creating ? (
        <CreateBarberForm
          onCreated={barber => router.push(`/admin/barbers/${barber.id}`)}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      <NoticeLine notice={notice} />

      <AsyncContent state={state} onRetry={reload}>
        {barbers =>
          barbers.length === 0 ? (
            <EmptyBlock text="Барберов пока нет. Добавьте первого." />
          ) : (
            <ul className={styles.list}>
              {barbers.map(barber => (
                <li key={barber.id} className={styles.card}>
                  <Link href={`/admin/barbers/${barber.id}`} className={styles.cardMain}>
                    {barber.photoUrl ? (
                      <img className={styles.photo} src={barber.photoUrl} alt="" />
                    ) : (
                      <span className={styles.photoPlaceholder} aria-hidden="true">
                        {barber.name.charAt(0)}
                      </span>
                    )}
                    <span className={styles.cardInfo}>
                      <span className={styles.strong}>{barber.name}</span>
                      <span className="muted">{barber.role}</span>
                      <span className={styles.badges}>
                        <span className={`${styles.badge} ${barber.isActive ? styles.badgeOn : styles.badgeOff}`}>
                          {barber.isActive ? 'Активен' : 'Скрыт'}
                        </span>
                        <span className={`${styles.badge} ${barber.telegramLinked ? styles.badgeOn : styles.badgeMuted}`}>
                          {telegramLabel(barber.telegramLinked)}
                        </span>
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    className={`btn btn-ghost ${styles.dangerButton}`}
                    disabled={busyId !== null}
                    onClick={() => remove(barber)}
                  >
                    {busyId === barber.id ? 'Удаляем…' : 'Удалить'}
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncContent>
    </section>
  )
}
