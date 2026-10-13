import type { CSSProperties } from 'react'
import Link from 'next/link'

import { plural, type BarberDto } from '@barber/shared'

import { shop } from '@/data/shop'

import { HeroVideo } from './HeroVideo'
import styles from './Hero.module.css'

type Stat = {
  value: string
  label: string
}

/** Средний рейтинг, взвешенный по числу отзывов каждого барбера. */
function weightedRating(barbers: readonly BarberDto[]): number {
  const totals = barbers.reduce(
    (acc, barber) => ({
      score: acc.score + barber.rating * barber.reviewsCount,
      count: acc.count + barber.reviewsCount,
    }),
    { score: 0, count: 0 },
  )
  return totals.count === 0 ? 0 : totals.score / totals.count
}

function buildStats(barbers: readonly BarberDto[]): Stat[] {
  const maxExperience = Math.max(0, ...barbers.map(barber => barber.experienceYears))
  const reviewsTotal = barbers.reduce((sum, barber) => sum + barber.reviewsCount, 0)
  return [
    { value: `${maxExperience}+`, label: `${plural(maxExperience, ['год', 'года', 'лет'])} опыта` },
    { value: weightedRating(barbers).toFixed(1), label: 'средний рейтинг' },
    { value: String(reviewsTotal), label: plural(reviewsTotal, ['отзыв', 'отзыва', 'отзывов']) },
  ]
}

/* Заголовок по центру, две строки. Слово «не нужно» — оранжевым. */
const titleLines: readonly (readonly { text: string; accent?: boolean }[])[] = [
  [{ text: 'Стрижка, после которой' }],
  [{ text: 'не нужно', accent: true }, { text: ' ничего поправлять' }],
]

/** Индекс строки для стаггера анимации. */
const lineStyle = (index: number): CSSProperties => ({ '--line': index }) as CSSProperties

type Props = {
  barbers: readonly BarberDto[]
}

export function Hero({ barbers }: Props) {
  const stats = buildStats(barbers)

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <HeroVideo className={styles.video} />
      <div className={styles.shade} aria-hidden="true" />
      <span className={styles.watermark} aria-hidden="true">
        {shop.name}
      </span>

      <div className={`container ${styles.inner}`}>
        <h1 id="hero-title" className={styles.heroTitle} aria-label="Стрижка, после которой не нужно ничего поправлять">
          <span className={styles.titleText} aria-hidden="true">
            {titleLines.map((parts, i) => (
              <span key={i} className={styles.heroLine} style={lineStyle(i)}>
                <span className={styles.heroLineInner}>
                  {parts.map(part =>
                    part.accent ? <em key={part.text}>{part.text}</em> : <span key={part.text}>{part.text}</span>,
                  )}
                </span>
              </span>
            ))}
          </span>
        </h1>

        <div className={styles.foot}>
          <p className={`l-kicker ${styles.eyebrow}`}>{shop.fullName} · Ташкент</p>
          <p className={styles.heroLead}>{shop.tagline}. Онлайн-запись за минуту — без звонков и ожидания.</p>
          <div className={styles.heroActions}>
            <Link href="/book" className="btn btn-primary btn-lg">
              Записаться онлайн
            </Link>
            <a href="#services" className="btn btn-ghost btn-lg">
              Услуги и цены
            </a>
          </div>
          <dl className={styles.stats}>
            {stats.map(stat => (
              <div key={stat.label} className={styles.stat}>
                <dt className={styles.statLabel}>{stat.label}</dt>
                <dd className={styles.statValue}>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
