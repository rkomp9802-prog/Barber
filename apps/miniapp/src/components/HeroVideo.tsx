import { useEffect, useRef } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
/** События, которые браузер считает жестом пользователя (разрешают play()). */
const GESTURE_EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const

/**
 * Фоновое видео шапки главной: без звука, по кругу, лёгкая версия (640×360, ~270 КБ).
 * Пока видео грузится или если играть нельзя — видна заставка.
 * Не играет при «Убрать анимацию» (prefers-reduced-motion), на паузе вне экрана и в свёрнутом приложении.
 * Встроенный браузер Telegram (Android WebView) запрещает автоплей — тогда видео стартует с первого касания.
 */
export function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    // Атрибут muted в JSX ненадёжен для автоплея: выставляем свойство явно.
    video.muted = true

    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    let reduced = media.matches
    let inView = true

    const removeGestureListeners = () => {
      for (const event of GESTURE_EVENTS) document.removeEventListener(event, onFirstGesture)
    }
    const waitForGesture = () => {
      for (const event of GESTURE_EVENTS) document.addEventListener(event, onFirstGesture, { passive: true })
    }
    const sync = () => {
      if (!reduced && inView && !document.hidden) video.play().catch(waitForGesture)
      else video.pause()
    }
    function onFirstGesture() {
      removeGestureListeners()
      sync()
    }
    const onMotionChange = () => {
      reduced = media.matches
      sync()
    }

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(entries => {
            inView = entries.some(entry => entry.isIntersecting)
            sync()
          })
    observer?.observe(video)
    media.addEventListener('change', onMotionChange)
    document.addEventListener('visibilitychange', sync)
    sync()

    return () => {
      observer?.disconnect()
      removeGestureListeners()
      media.removeEventListener('change', onMotionChange)
      document.removeEventListener('visibilitychange', sync)
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
