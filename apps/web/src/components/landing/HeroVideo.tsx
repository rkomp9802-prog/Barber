'use client'

import { useEffect, useRef } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
/** События, которые браузер считает жестом пользователя (разрешают play()). */
const GESTURE_EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const

type Props = {
  className?: string
}

/**
 * Фоновое видео героя: без звука, по кругу, поверх видео — контент секции.
 * Не играет при prefers-reduced-motion (остаётся постер), на паузе вне экрана и в скрытой вкладке.
 * Если браузер запретил автоплей, остаётся постер, а видео запускается при первом касании страницы.
 */
export function HeroVideo({ className }: Props) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    // Атрибут muted в JSX ненадёжен для автоплея: выставляем свойство явно.
    video.muted = true

    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    let reduced = media.matches
    let inView = true

    // Встроенный браузер Telegram (Android WebView) и режим энергосбережения запрещают автоплей даже без звука:
    // тогда запускаем видео при первом касании страницы — жест пользователя снимает запрет.
    const onFirstGesture = () => {
      removeGestureListeners()
      sync()
    }
    const removeGestureListeners = () => {
      for (const event of GESTURE_EVENTS) document.removeEventListener(event, onFirstGesture)
    }
    const waitForGesture = () => {
      for (const event of GESTURE_EVENTS) document.addEventListener(event, onFirstGesture, { passive: true })
    }

    const sync = () => {
      const shouldPlay = !reduced && inView && !document.hidden
      if (shouldPlay) {
        video.play().catch(waitForGesture)
      } else {
        video.pause()
      }
    }

    const onMotionChange = () => {
      reduced = media.matches
      sync()
    }

    const onVisibilityChange = () => sync()

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            entries => {
              inView = entries.some(entry => entry.isIntersecting)
              sync()
            },
            { threshold: 0 },
          )
    observer?.observe(video)

    media.addEventListener('change', onMotionChange)
    document.addEventListener('visibilitychange', onVisibilityChange)
    sync()

    return () => {
      observer?.disconnect()
      removeGestureListeners()
      media.removeEventListener('change', onMotionChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return (
    <video
      ref={ref}
      className={className}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/video/hero-poster.webp"
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
    >
      <source src="/video/hero.mp4" type="video/mp4" />
    </video>
  )
}
