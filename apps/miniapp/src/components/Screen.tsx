import type { ReactNode } from 'react'

import { useBackButton } from '../hooks/useBackButton'
import { isInsideTelegram } from '../telegram'

type Props = {
  title: string
  subtitle?: string
  /** Обработчик «Назад»: нативная BackButton в Telegram, кнопка в шапке в браузере. */
  onBack?: (() => void) | null
  children: ReactNode
  footer?: ReactNode
}

export function Screen({ title, subtitle, onBack = null, children, footer }: Props) {
  useBackButton(onBack)
  const showInlineBack = onBack !== null && !isInsideTelegram()

  return (
    <div className="screen">
      <header className="screen-header">
        {showInlineBack && (
          <button type="button" className="back-link" onClick={onBack ?? undefined}>
            <span aria-hidden="true">‹</span> Назад
          </button>
        )}
        {subtitle && <p className="screen-subtitle">{subtitle}</p>}
        <h1 className="screen-title">{title}</h1>
      </header>
      <main className="screen-body">{children}</main>
      {footer}
    </div>
  )
}
