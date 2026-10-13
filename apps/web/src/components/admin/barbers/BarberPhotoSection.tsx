'use client'

import { useState } from 'react'

import type { AdminBarberDto } from '@barber/shared'

import { updateBarber, uploadFile } from '@/lib/adminApi'
import { barberErrorMessage, photoFileError, uploadContentType } from '@/lib/admin/barbersView'

import { NoticeLine, Panel, type Notice } from './BarberUi'
import styles from './barbers.module.css'

type Props = {
  barber: AdminBarberDto
  onChange: (barber: AdminBarberDto) => void
}

export function BarberPhotoSection({ barber, onChange }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [inputKey, setInputKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  async function upload() {
    if (!file) return
    const problem = photoFileError(file)
    const contentType = uploadContentType(file.type)
    if (problem || contentType === null) {
      setNotice({ tone: 'error', text: problem ?? 'Допустимы только JPEG, PNG или WebP.' })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const uploaded = await uploadFile({ kind: 'barber-photo', contentType, size: file.size }, file)
      const updated = await updateBarber(barber.id, { photoUrl: uploaded.publicUrl })
      onChange(updated)
      setFile(null)
      setInputKey(key => key + 1)
      setNotice({ tone: 'ok', text: 'Фото обновлено.' })
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: barberErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto() {
    setBusy(true)
    setNotice(null)
    try {
      const updated = await updateBarber(barber.id, { photoUrl: null })
      onChange(updated)
      setNotice({ tone: 'ok', text: 'Фото убрано.' })
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: barberErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel id="barber-photo" title="Фото" hint="JPEG, PNG или WebP, до 5 МБ.">
      <div className={styles.photoRow}>
        {barber.photoUrl ? (
          <img className={styles.photoLarge} src={barber.photoUrl} alt={`Фото: ${barber.name}`} />
        ) : (
          <span className={`${styles.photoLarge} ${styles.photoPlaceholder}`} aria-hidden="true">
            {barber.name.charAt(0)}
          </span>
        )}
        <div className={styles.photoControls}>
          <input
            key={inputKey}
            className={styles.fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            aria-label="Выбрать фото барбера"
            onChange={event => {
              setFile(event.target.files?.[0] ?? null)
              setNotice(null)
            }}
          />
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" disabled={busy || !file} onClick={upload}>
              {busy ? 'Загружаем…' : 'Загрузить фото'}
            </button>
            {barber.photoUrl ? (
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={removePhoto}>
                Убрать фото
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <NoticeLine notice={notice} />
    </Panel>
  )
}
