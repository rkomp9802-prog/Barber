import { useEffect, useRef } from 'react'

import { isInsideTelegram, onMainButtonClick, setMainButton } from '../telegram'

export type MainAction = {
  text: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

/**
 * Управляет нативной MainButton Telegram. Возвращает false в обычном браузере —
 * тогда вызывающий компонент рисует свою кнопку.
 */
export function useMainButton(action: MainAction | null): boolean {
  const clickRef = useRef<(() => void) | null>(null)
  const text = action?.text ?? null
  const enabled = action ? !action.disabled : false
  const loading = action?.loading ?? false

  useEffect(() => {
    clickRef.current = action && !action.disabled && !action.loading ? action.onClick : null
  })

  useEffect(() => onMainButtonClick(() => clickRef.current?.()), [])

  useEffect(() => {
    setMainButton(text === null ? null : { text, enabled, loading })
  }, [text, enabled, loading])

  useEffect(() => () => void setMainButton(null), [])

  return isInsideTelegram()
}
