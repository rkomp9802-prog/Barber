'use client'

import { getSettings } from '@/lib/adminApi'
import { useAsyncData } from '@/lib/admin/useAsyncData'

import { AsyncContent } from '../StateBlocks'
import { SettingsForm } from './SettingsForm'
import styles from './settings.module.css'

export function SettingsPage() {
  const settings = useAsyncData(getSettings, [])

  return (
    <section className={styles.page} aria-labelledby="settings-title">
      <h1 id="settings-title" className={styles.title}>
        Настройки салона
      </h1>
      <AsyncContent state={settings.state} onRetry={settings.reload}>
        {saved => <SettingsForm initial={saved} />}
      </AsyncContent>
    </section>
  )
}
