import type { ReactNode } from 'react'

import { type MainAction, useMainButton } from '../hooks/useMainButton'

type Props = {
  summary?: ReactNode
  action?: MainAction | null
}

/**
 * Липкая нижняя панель: краткая сводка + основное действие.
 * В Telegram действие выполняет нативная MainButton, в браузере — обычная кнопка.
 * На экране должна быть только одна BottomBar.
 */
export function BottomBar({ summary, action = null }: Props) {
  const isNative = useMainButton(action)
  const inlineAction = isNative ? null : action

  if (!summary && !inlineAction) return null
  return (
    <div className="bottom-bar">
      {summary && <div className="bottom-summary">{summary}</div>}
      {inlineAction && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={inlineAction.disabled || inlineAction.loading}
          aria-busy={inlineAction.loading || undefined}
          onClick={inlineAction.onClick}
        >
          {inlineAction.loading ? 'Подождите…' : inlineAction.text}
        </button>
      )}
    </div>
  )
}
