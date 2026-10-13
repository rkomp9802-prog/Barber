'use client'

import Image from 'next/image'
import { useRef, useState, type KeyboardEvent } from 'react'

import type { BarberDto } from '@barber/shared'

import { galleryItems, isUnoptimizedSrc } from '@/lib/landingMedia'

import styles from './Gallery.module.css'

type Props = {
  barbers: readonly BarberDto[]
}

export function GallerySection({ barbers }: Props) {
  const items = galleryItems(barbers)
  const trackRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const [active, setActive] = useState(0)

  // Активная карточка — та, чей центр ближе всего к центру ленты.
  function updateActive() {
    const track = trackRef.current
    if (!track) return
    const center = track.getBoundingClientRect().left + track.clientWidth / 2
    let best = 0
    let bestDistance = Number.POSITIVE_INFINITY
    Array.from(track.children).forEach((el, index) => {
      const rect = el.getBoundingClientRect()
      const distance = Math.abs(rect.left + rect.width / 2 - center)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    })
    setActive(best)
  }

  function onScroll() {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      updateActive()
    })
  }

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current
    if (!track) return
    const card = track.firstElementChild as HTMLElement | null
    if (!card) return
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: reduce ? 'auto' : 'smooth' })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollByCard(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollByCard(-1)
    }
  }

  return (
    <section id="gallery" className={styles.section} aria-labelledby="gallery-title">
      <header className="l-band">
        <p className="l-kicker">Галерея</p>
        <h2 id="gallery-title" className="l-title reveal">
          Наши работы
        </h2>
      </header>

      <div className={styles.stage}>
        <span className={styles.bgWord} aria-hidden="true">
          Работы
        </span>

        <div className={styles.row}>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowPrev}`}
            aria-label="Предыдущая работа"
            onClick={() => scrollByCard(-1)}
          >
            <span className={styles.glyph} aria-hidden="true" />
          </button>

          <div
            ref={trackRef}
            className={styles.track}
            role="region"
            tabIndex={0}
            aria-label="Галерея работ"
            onKeyDown={onKeyDown}
            onScroll={onScroll}
          >
            {items.map((src, index) => (
              <figure
                key={`${src}-${index}`}
                className={styles.slide}
                data-active={index === active ? '' : undefined}
                data-side={index < active ? 'left' : index > active ? 'right' : undefined}
              >
                <div className={`l-frame ${styles.frame}`}>
                  <Image
                    src={src}
                    alt={`Работа барбершопа, фото ${index + 1}`}
                    fill
                    sizes="(min-width: 900px) 300px, 60vw"
                    unoptimized={isUnoptimizedSrc(src)}
                    className={styles.photo}
                  />
                </div>
              </figure>
            ))}
          </div>

          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowNext}`}
            aria-label="Следующая работа"
            onClick={() => scrollByCard(1)}
          >
            <span className={styles.glyph} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
