'use client'

import { useState } from 'react'

import type { AdminBarberDto, AdminPortfolioItemDto } from '@barber/shared'

import {
  addPortfolioItem,
  deletePortfolioItem,
  reorderPortfolio,
  uploadFile,
} from '@/lib/adminApi'
import {
  PORTFOLIO_MAX_ITEMS,
  barberErrorMessage,
  movePortfolioIds,
  photoFileError,
  uploadContentType,
} from '@/lib/admin/barbersView'

import { EmptyBlock } from '../StateBlocks'
import { NoticeLine, Panel, type Notice } from './BarberUi'
import styles from './barbers.module.css'

/** Функция от актуального списка портфолио: родитель применяет её к последнему состоянию, а не к замыканию. */
export type PortfolioUpdater = (current: AdminPortfolioItemDto[]) => AdminPortfolioItemDto[]

type Props = {
  barber: AdminBarberDto
  onPortfolioChange: (update: PortfolioUpdater) => void
}

function bySortOrder(a: AdminPortfolioItemDto, b: AdminPortfolioItemDto): number {
  return a.sortOrder - b.sortOrder
}

export function BarberPortfolioSection({ barber, onPortfolioChange }: Props) {
  const items = [...barber.portfolio].sort(bySortOrder)
  const [file, setFile] = useState<File | null>(null)
  const [inputKey, setInputKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  /** Все действия идут через один флаг busy: параллельные правки порядка и списка не нужны. */
  async function run(action: () => Promise<void>, successText?: string) {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      if (successText) setNotice({ tone: 'ok', text: successText })
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: barberErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  function addPhoto() {
    if (!file) return
    if (items.length >= PORTFOLIO_MAX_ITEMS) {
      setNotice({ tone: 'error', text: `В портфолио не больше ${PORTFOLIO_MAX_ITEMS} фото.` })
      return
    }
    const problem = photoFileError(file)
    const contentType = uploadContentType(file.type)
    if (problem || contentType === null) {
      setNotice({ tone: 'error', text: problem ?? 'Допустимы только JPEG, PNG или WebP.' })
      return
    }
    void run(async () => {
      const uploaded = await uploadFile({ kind: 'portfolio', contentType, size: file.size }, file)
      const item = await addPortfolioItem(barber.id, { imageUrl: uploaded.publicUrl })
      onPortfolioChange(current => [...current, item])
      setFile(null)
      setInputKey(key => key + 1)
    }, 'Фото добавлено в портфолио.')
  }

  function removeItem(item: AdminPortfolioItemDto) {
    if (!window.confirm('Удалить фото из портфолио?')) return
    void run(async () => {
      await deletePortfolioItem(item.id)
      onPortfolioChange(current => current.filter(existing => existing.id !== item.id))
    }, 'Фото удалено.')
  }

  function move(index: number, delta: -1 | 1) {
    const nextIds = movePortfolioIds(
      items.map(item => item.id),
      index,
      delta,
    )
    if (!nextIds) return
    void run(async () => {
      const reordered = await reorderPortfolio(barber.id, { itemIds: nextIds })
      onPortfolioChange(() => reordered)
    }, 'Порядок сохранён.')
  }

  return (
    <Panel id="barber-portfolio" title="Портфолио" hint="Фото работ. Порядок задают кнопки «Выше» и «Ниже».">
      <div className={styles.uploadRow}>
        <input
          key={inputKey}
          className={styles.fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          aria-label="Выбрать фото для портфолио"
          onChange={event => {
            setFile(event.target.files?.[0] ?? null)
            setNotice(null)
          }}
        />
        <button type="button" className="btn btn-primary" disabled={busy || !file} onClick={addPhoto}>
          {busy ? 'Загружаем…' : 'Добавить фото'}
        </button>
      </div>
      <NoticeLine notice={notice} />

      {items.length === 0 ? (
        <EmptyBlock text="Портфолио пусто. Добавьте первое фото." />
      ) : (
        <ul className={styles.portfolioGrid}>
          {items.map((item, index) => (
            <li key={item.id} className={styles.portfolioItem}>
              <img className={styles.portfolioImage} src={item.imageUrl} alt={`Работа ${index + 1}`} />
              <div className={styles.portfolioActions}>
                <button
                  type="button"
                  className={`btn btn-ghost ${styles.smallButton}`}
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                >
                  Выше
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost ${styles.smallButton}`}
                  disabled={busy || index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Ниже
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost ${styles.smallButton} ${styles.dangerButton}`}
                  disabled={busy}
                  onClick={() => removeItem(item)}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
