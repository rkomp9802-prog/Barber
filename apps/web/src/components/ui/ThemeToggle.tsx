'use client'

import { useSyncExternalStore } from 'react'

import { THEME_STORAGE_KEY, currentTheme, type Theme } from '@/lib/theme'

import styles from './ThemeToggle.module.css'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const THEME_EVENT = 'themechange'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  window.addEventListener(THEME_EVENT, onChange)
  return () => {
    media.removeEventListener('change', onChange)
    window.removeEventListener(THEME_EVENT, onChange)
  }
}

function readTheme(): Theme {
  return currentTheme(document.documentElement, window.matchMedia(DARK_QUERY).matches)
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Приватный режим браузера: тема просто не запомнится.
  }
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | undefined>(subscribe, readTheme, () => undefined)
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
  const label = nextTheme === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему'

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => applyTheme(nextTheme)}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}
