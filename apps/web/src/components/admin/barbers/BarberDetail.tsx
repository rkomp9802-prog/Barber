'use client'

import Link from 'next/link'
import { useState } from 'react'

import type { AdminBarberDto, AdminServiceDto } from '@barber/shared'

import { getBarber, listServices } from '@/lib/adminApi'
import { telegramLabel } from '@/lib/admin/barbersView'
import { useAsyncData } from '@/lib/admin/useAsyncData'

import { AsyncContent } from '../StateBlocks'
import { BarberLinkCodeSection } from './BarberLinkCodeSection'
import { BarberPhotoSection } from './BarberPhotoSection'
import { BarberPortfolioSection, type PortfolioUpdater } from './BarberPortfolioSection'
import { BarberProfileSection } from './BarberProfileSection'
import { BarberScheduleSection } from './BarberScheduleSection'
import { BarberServicesSection } from './BarberServicesSection'
import styles from './barbers.module.css'

type Props = {
  id: string
}

type Loaded = {
  barber: AdminBarberDto
  catalog: AdminServiceDto[]
}

/** Карточка барбера: загружает барбера и каталог услуг, дальше разделы работают с локальной копией. */
export function BarberDetail({ id }: Props) {
  const { state, reload } = useAsyncData<Loaded>(
    async () => {
      const [barber, catalog] = await Promise.all([getBarber(id), listServices()])
      return { barber, catalog }
    },
    [id],
  )

  return (
    <section className={styles.page} aria-label="Карточка барбера">
      <Link href="/admin/barbers" className={styles.back}>
        ← Все барберы
      </Link>
      <AsyncContent state={state} onRetry={reload}>
        {loaded => <BarberEditor initial={loaded.barber} catalog={loaded.catalog} />}
      </AsyncContent>
    </section>
  )
}

type EditorProps = {
  initial: AdminBarberDto
  catalog: AdminServiceDto[]
}

function BarberEditor({ initial, catalog }: EditorProps) {
  const [barber, setBarber] = useState(initial)

  // Портфолио меняем только через функциональный апдейт: асинхронная операция не затирает другие секции.
  function changePortfolio(update: PortfolioUpdater) {
    setBarber(current => ({ ...current, portfolio: update(current.portfolio) }))
  }

  return (
    <>
      <div className={styles.heading}>
        <h1 className={styles.title}>{barber.name}</h1>
        <p className="muted">
          {barber.role} · {telegramLabel(barber.telegramLinked)}
        </p>
      </div>
      <BarberProfileSection barber={barber} onChange={setBarber} />
      <BarberPhotoSection barber={barber} onChange={setBarber} />
      <BarberServicesSection barber={barber} catalog={catalog} onChange={setBarber} />
      <BarberScheduleSection barber={barber} onChange={setBarber} />
      <BarberPortfolioSection barber={barber} onPortfolioChange={changePortfolio} />
      <BarberLinkCodeSection barberId={barber.id} />
    </>
  )
}
