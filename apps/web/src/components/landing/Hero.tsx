import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { plural, type BarberDto } from '@barber/shared'

import { shop } from '@/data/shop'

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

/* Заголовок в две колонки по бокам от головы: слева «СТРИЖКА, / ПОСЛЕ КОТОРОЙ»,
   справа «НЕ НУЖНО / НИЧЕГО ПОПРАВЛЯТЬ». На мобильном колонки складываются в один столбец. */
const titleLeft: readonly string[] = ['Стрижка,', 'после которой']
const titleRight: readonly { text: string; accent?: boolean }[] = [
  { text: 'не нужно', accent: true },
  { text: 'ничего поправлять' },
]

/** Индекс строки для стаггера анимации: левая колонка, затем правая. */
const lineStyle = (index: number): CSSProperties => ({ '--line': index }) as CSSProperties

type Props = {
  barbers: readonly BarberDto[]
}

export function Hero({ barbers }: Props) {
  const stats = buildStats(barbers)

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <Image src="/stock/hero-bg.webp" alt="" fill preload sizes="100vw" className={styles.bg} />
      <div className={styles.shade} aria-hidden="true" />
      <span className={styles.watermark} aria-hidden="true">
        {shop.name}
      </span>

      <div className={`container ${styles.inner}`}>
        <div className={styles.figure}>
          <Image
            src="/stock/hero-portrait.webp"
            alt="Стрижка в барбершопе Sharp"
            fill
            preload
            sizes="(min-width: 900px) 40vw, 80vw"
            className={styles.portrait}
          />
        </div>

        <h1 id="hero-title" className={styles.heroTitle} aria-label="Стрижка, после которой не нужно ничего поправлять">
          <span className={styles.colLeft} aria-hidden="true">
            {titleLeft.map((text, i) => (
              <span key={text} className={styles.heroLine} style={lineStyle(i)}>
                <span className={styles.heroLineInner}>{text}</span>
              </span>
            ))}
          </span>
          <span className={styles.colRight} aria-hidden="true">
            {titleRight.map((line, i) => (
              <span key={line.text} className={styles.heroLine} style={lineStyle(titleLeft.length + i)}>
                <span className={styles.heroLineInner}>
                  {line.accent ? <em>{line.text}</em> : line.text}
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
