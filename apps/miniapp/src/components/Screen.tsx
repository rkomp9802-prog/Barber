import { type ReactNode, useEffect, useRef, useState } from 'react'

import { useBackButton } from '../hooks/useBackButton'
import { isInsideTelegram } from '../telegram'
import { Icon } from './Icon'

type Props = {
  title: string
  subtitle?: string
  /** Обработчик «Назад»: нативная BackButton в Telegram, кнопка в шапке в браузере. */
  onBack?: (() => void) | null
  children: ReactNode
  footer?: ReactNode
}

/** Крупный заголовок ушёл под край экрана → показываем компактную стеклянную шапку (как в iOS). */
function useCompactTitle(title: React.RefObject<HTMLElement | null>): boolean {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const node = title.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setCompact(entry ? !entry.isIntersecting : false))
    observer.observe(node)
    return () => observer.disconnect()
  }, [title])
  return compact
}

export function Screen({ title, subtitle, onBack = null, children, footer }: Props) {
  useBackButton(onBack)
  const showInlineBack = onBack !== null && !isInsideTelegram()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const compact = useCompactTitle(titleRef)

  return (
    <div className="screen">
      <div className={`nav-compact${compact ? ' is-visible' : ''}`} aria-hidden="true">
        <span className="nav-compact-title">{title}</span>
      </div>
      <header className="screen-header">
        {showInlineBack && (
          <button type="button" className="back-link" onClick={onBack ?? undefined}>
            <Icon name="chevronLeft" size={20} />
            Назад
          </button>
        )}
        {subtitle && <p className="eyebrow">{subtitle}</p>}
        <h1 ref={titleRef} className="large-title">
          {title}
        </h1>
      </header>
      <main className="screen-body">{children}</main>
      {footer}
    </div>
  )
}
