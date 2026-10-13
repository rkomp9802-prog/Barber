import Link from 'next/link'

import { plural, type BarberDto } from '@barber/shared'

import { BarberAvatar } from '@/components/ui/BarberAvatar'
import { Stars } from '@/components/ui/Stars'

import styles from './landing.module.css'

type CardProps = {
  barber: BarberDto
  index: number
}

function BarberCard({ barber, index }: CardProps) {
  const reviewsLabel = `${barber.reviewsCount} ${plural(barber.reviewsCount, ['отзыв', 'отзыва', 'отзывов'])}`
  const experienceLabel = `${barber.experienceYears} ${plural(barber.experienceYears, ['год', 'года', 'лет'])} опыта`

  return (
    <li className={styles.barberCard}>
      <div className={styles.barberTop}>
        <BarberAvatar name={barber.name} photoUrl={barber.photoUrl} index={index} size="lg" />
        <span className={styles.barberExp}>{experienceLabel}</span>
      </div>
      <h3 className={styles.barberName}>{barber.name}</h3>
      <p className={styles.barberRole}>{barber.role}</p>
      <p className={styles.barberRating}>
        <Stars rating={barber.rating} />
        <strong>{barber.rating.toFixed(1)}</strong>
        <span className="muted">· {reviewsLabel}</span>
      </p>
      <p className={`muted ${styles.barberBio}`}>{barber.bio}</p>
      <Link href={`/book?barber=${encodeURIComponent(barber.id)}`} className={styles.barberLink}>
        Записаться к {barber.name}
        <span aria-hidden="true"> →</span>
      </Link>
    </li>
  )
}

type Props = {
  barbers: readonly BarberDto[]
}

export function BarbersSection({ barbers }: Props) {
  return (
    <section id="barbers" className={`section ${styles.barbersSection}`} aria-labelledby="barbers-title">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Команда</p>
          <h2 id="barbers-title" className="section-title">
            Барберы, к которым возвращаются
          </h2>
        </div>
        <ul className={styles.barberGrid}>
          {barbers.map((barber, index) => (
            <BarberCard key={barber.id} barber={barber} index={index} />
          ))}
        </ul>
      </div>
    </section>
  )
}
