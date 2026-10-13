import { useEffect, useRef } from 'react'

import { showBackButton } from '../telegram'

/** Показывает нативную BackButton Telegram, пока компонент смонтирован и handler задан. */
export function useBackButton(handler: (() => void) | null): void {
  const handlerRef = useRef(handler)
  const enabled = handler !== null

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!enabled) return undefined
    return showBackButton(() => handlerRef.current?.())
  }, [enabled])
}
