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

function HeroArt() {
  return (
    <div className={styles.heroArt} aria-hidden="true">
      <div className={styles.poster}>
        <div className={styles.posterStripes} />
        <div className={styles.posterMedallion}>
          <span className={styles.posterEst}>est. 2018</span>
          <span className={styles.posterName}>{shop.name}</span>
          <span className={styles.posterCity}>Tashkent</span>
        </div>
      </div>
      <div className={styles.heroBadge}>
        <span className={styles.heroBadgeDot} />
        <span>
          <span className={styles.heroBadgeLabel}>Онлайн-запись</span>
          <strong>свободные окна видно сразу</strong>
        </span>
      </div>
    </div>
  )
}

type Props = {
  barbers: readonly BarberDto[]
}

export function Hero({ barbers }: Props) {
  const stats = buildStats(barbers)

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`container ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">{shop.fullName} · Ташкент</p>
          <h1 id="hero-title" className={styles.heroTitle}>
            Стрижка, после которой <em>не нужно</em> ничего поправлять
          </h1>
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
        <HeroArt />
      </div>
    </section>
  )
}
