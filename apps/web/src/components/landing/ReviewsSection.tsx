import { formatDayMonth, tashkentDateKey, type PublicReviewDto } from '@barber/shared'

import { Stars } from '@/components/ui/Stars'

import styles from './Reviews.module.css'

type CardProps = {
  review: PublicReviewDto
}

function ReviewCard({ review }: CardProps) {
  const barberName = review.barberName
  const dateKey = tashkentDateKey(new Date(review.createdAt))

  return (
    <div className={`l-frame ${styles.card}`}>
      <span className={styles.quoteMark} aria-hidden="true">
        “
      </span>
      <figure className={styles.figure}>
        <Stars rating={review.rating} />
        <blockquote className={styles.quote}>
          <p>{review.comment}</p>
        </blockquote>
        <figcaption className={styles.caption}>
          <strong className={styles.name}>{review.clientName}</strong>
          <span className={styles.meta}>
            {barberName ? `у барбера ${barberName} · ` : ''}
            <time dateTime={dateKey}>{formatDayMonth(dateKey)}</time>
          </span>
        </figcaption>
      </figure>
    </div>
  )
}

type Props = {
  reviews: readonly PublicReviewDto[]
}

export function ReviewsSection({ reviews }: Props) {
  if (reviews.length === 0) return null
  return (
    <section id="reviews" className={styles.section} aria-labelledby="reviews-title">
      <div className="l-band">
        <p className="l-kicker">Отзывы</p>
        <h2 id="reviews-title" className="l-title reveal">
          Что говорят клиенты
        </h2>
      </div>
      <div className={`${styles.body} reveal`}>
        <ul className={styles.track}>
          {reviews.map(review => (
            <li key={review.id} className={styles.item}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
