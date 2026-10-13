'use client'

import type { LenisOptions } from 'lenis'
import { ReactLenis } from 'lenis/react'
import 'lenis/dist/lenis.css'
import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'

/** Вынесено в модуль: ReactLenis пересоздаёт экземпляр, если изменился JSON опций. */
const LENIS_OPTIONS: LenisOptions = {
  lerp: 0.1, // спокойная инерция без «мыла»
  smoothWheel: true,
  anchors: true, // переходы по якорям #... идут через Lenis
  // touch не трогаем: остаётся нативный скролл (syncTouch выключен по умолчанию)
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** На сервере и при гидратации считаем, что движение разрешено; реальное значение берётся после монтирования. */
function getServerReducedMotion() {
  return false
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  )

  if (reducedMotion) return <>{children}</>

  return (
    <ReactLenis root options={LENIS_OPTIONS}>
      {children}
    </ReactLenis>
  )
}
