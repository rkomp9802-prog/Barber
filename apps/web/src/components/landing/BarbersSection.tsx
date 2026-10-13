import Image from 'next/image'
import Link from 'next/link'

import { plural, type BarberDto } from '@barber/shared'

import { Stars } from '@/components/ui/Stars'
import { barberPhotoSrc, isUnoptimizedSrc } from '@/lib/landingMedia'

import styles from './Barbers.module.css'

type CardProps = {
  barber: BarberDto
  index: number
}

function BarberCard({ barber, index }: CardProps) {
  const reviewsLabel = `${barber.reviewsCount} ${plural(barber.reviewsCount, ['отзыв', 'отзыва', 'отзывов'])}`
  const experienceLabel = `${barber.experienceYears} ${plural(barber.experienceYears, ['год', 'года', 'лет'])} опыта`
  const photo = barberPhotoSrc(barber, index)

  return (
    <li className={`${styles.card} reveal`}>
      <div className={`l-frame ${styles.photoFrame}`}>
        <Image
          src={photo}
          alt={barber.name}
          fill
          sizes="(min-width: 1100px) 25vw, (min-width: 600px) 50vw, 100vw"
          unoptimized={isUnoptimizedSrc(photo)}
          className={styles.photo}
        />
        <span className={styles.shade} aria-hidden="true" />
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{barber.name}</h3>
        <p className={styles.role}>{barber.role}</p>
        <p className={styles.meta}>
          <span>{experienceLabel}</span>
          <span className={styles.rating}>
            <Stars rating={barber.rating} /> <strong>{barber.rating.toFixed(1)}</strong>
          </span>
          <span>{reviewsLabel}</span>
        </p>
        <p className={styles.bio}>{barber.bio}</p>
        <Link href={`/book?barber=${encodeURIComponent(barber.id)}`} className={styles.cta}>
          Записаться
          <span className="visually-hidden"> к {barber.name}</span>
        </Link>
      </div>
    </li>
  )
}

type Props = {
  barbers: readonly BarberDto[]
}

export function BarbersSection({ barbers }: Props) {
  return (
    <section id="barbers" className={styles.section} aria-labelledby="barbers-title">
      <header className="l-band">
        <p className="l-kicker">Команда</p>
        <h2 id="barbers-title" className="l-title reveal">
          Барберы, к которым возвращаются
        </h2>
      </header>
      <div className="container">
        <ul className={`${styles.grid} reveal-group`}>
          {barbers.map((barber, index) => (
            <BarberCard key={barber.id} barber={barber} index={index} />
          ))}
        </ul>
      </div>
    </section>
  )
}
