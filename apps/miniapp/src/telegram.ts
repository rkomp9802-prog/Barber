import { applyCssVars, type ColorScheme, themeToCssVars, type ThemeParams } from './theme'

/**
 * Тонкая типизированная обёртка над официальным скриптом telegram-web-app.js.
 * В обычном браузере скрипт тоже определяет WebApp, но initData там пустая —
 * поэтому все вызовы защищены и приложение остаётся работоспособным для разработки.
 */

type MainButtonParams = {
  text?: string
  color?: string
  text_color?: string
  is_active?: boolean
  is_visible?: boolean
}

type TelegramMainButton = {
  setParams: (params: MainButtonParams) => void
  showProgress: (leaveActive?: boolean) => void
  hideProgress: () => void
  onClick: (callback: () => void) => void
  offClick: (callback: () => void) => void
  hide: () => void
}

type TelegramBackButton = {
  show: () => void
  hide: () => void
  onClick: (callback: () => void) => void
  offClick: (callback: () => void) => void
}

type TelegramHaptics = {
  selectionChanged: () => void
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void
}

type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string }

type TelegramWebApp = {
  initData: string
  initDataUnsafe: { user?: TelegramUser }
  version: string
  colorScheme: ColorScheme
  themeParams: ThemeParams
  MainButton: TelegramMainButton
  BackButton: TelegramBackButton
  HapticFeedback?: TelegramHaptics
  ready: () => void
  expand: () => void
  isVersionAtLeast: (version: string) => boolean
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  showConfirm?: (message: string, callback: (confirmed: boolean) => void) => void
  onEvent: (event: 'themeChanged', handler: () => void) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export type MainButtonState = {
  text: string
  enabled: boolean
  loading: boolean
}

function webApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

function supports(version: string): boolean {
  const app = webApp()
  return app !== null && app.isVersionAtLeast(version)
}

/** true — приложение открыто внутри Telegram (есть подписанная initData). */
export function isInsideTelegram(): boolean {
  return (webApp()?.initData ?? '') !== ''
}

/** Сырая initData для заголовка x-telegram-init-data (пустая строка вне Telegram). */
export function getInitData(): string {
  return webApp()?.initData ?? ''
}

/** Имя пользователя Telegram для автозаполнения формы. */
export function getTelegramFirstName(): string {
  return webApp()?.initDataUnsafe.user?.first_name?.trim() ?? ''
}

function browserScheme(): ColorScheme {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

/** Применяет тему Telegram (или запасную тему браузера) к :root. */
export function applyTheme(): void {
  const app = webApp()
  const scheme = isInsideTelegram() && app ? app.colorScheme : browserScheme()
  const params = isInsideTelegram() ? app?.themeParams : undefined
  applyCssVars(themeToCssVars(params, scheme), document.documentElement)
}

/** Вызывается один раз при старте: ready, expand, тема и подписка на её смену. */
export function initTelegram(): void {
  applyTheme()
  const app = webApp()
  if (!app || !isInsideTelegram()) {
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
    return
  }
  app.ready()
  app.expand()
  app.onEvent('themeChanged', applyTheme)
  if (supports('6.1')) {
    app.setHeaderColor?.('secondary_bg_color')
    app.setBackgroundColor?.('secondary_bg_color')
  }
}

export function hapticSelection(): void {
  if (supports('6.1')) webApp()?.HapticFeedback?.selectionChanged()
}

export function hapticNotify(type: 'error' | 'success' | 'warning'): void {
  if (supports('6.1')) webApp()?.HapticFeedback?.notificationOccurred(type)
}

/** Подтверждение действия: нативный диалог Telegram или window.confirm в браузере. */
export function confirmAction(message: string): Promise<boolean> {
  const app = webApp()
  if (app?.showConfirm && isInsideTelegram() && supports('6.2')) {
    const showConfirm = app.showConfirm
    return new Promise(resolve => showConfirm(message, resolve))
  }
  return Promise.resolve(window.confirm(message))
}

/** Обновляет нативную MainButton. Возвращает false, если она недоступна (обычный браузер). */
export function setMainButton(state: MainButtonState | null): boolean {
  const app = webApp()
  if (!app || !isInsideTelegram()) return false
  if (!state) {
    app.MainButton.hideProgress()
    app.MainButton.hide()
    return true
  }
  // Telegram не затемняет неактивную кнопку сам — красим её в цвет подсказки.
  const active = state.enabled || state.loading
  const color = active ? app.themeParams.button_color : app.themeParams.hint_color
  app.MainButton.setParams({
    text: state.text,
    is_active: state.enabled && !state.loading,
    is_visible: true,
    ...(color ? { color } : {}),
    ...(app.themeParams.button_text_color ? { text_color: app.themeParams.button_text_color } : {}),
  })
  if (state.loading) app.MainButton.showProgress(false)
  else app.MainButton.hideProgress()
  return true
}

/** Подписка на нажатие MainButton; возвращает функцию отписки. */
export function onMainButtonClick(handler: () => void): () => void {
  const app = webApp()
  if (!app || !isInsideTelegram()) return () => undefined
  app.MainButton.onClick(handler)
  return () => app.MainButton.offClick(handler)
}

/** Показывает BackButton с обработчиком; возвращает функцию, которая её скрывает. */
export function showBackButton(handler: () => void): () => void {
  const app = webApp()
  if (!app || !isInsideTelegram()) return () => undefined
  app.BackButton.onClick(handler)
  app.BackButton.show()
  return () => {
    app.BackButton.offClick(handler)
    app.BackButton.hide()
  }
}
