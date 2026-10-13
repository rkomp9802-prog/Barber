import { formatDayMonth, tashkentDateKey, type PublicReviewDto } from '@barber/shared'

import { Stars } from '@/components/ui/Stars'

import styles from './landing.module.css'

type CardProps = {
  review: PublicReviewDto
  isFeatured: boolean
}

function ReviewCard({ review, isFeatured }: CardProps) {
  const barberName = review.barberName
  const dateKey = tashkentDateKey(new Date(review.createdAt))

  return (
    <li className={`${styles.reviewCard} ${isFeatured ? styles.reviewFeatured : ''}`}>
      <figure className={styles.reviewFigure}>
        <Stars rating={review.rating} />
        <blockquote className={styles.reviewQuote}>
          <p>{review.comment}</p>
        </blockquote>
        <figcaption className={styles.reviewCaption}>
          <strong>{review.clientName}</strong>
          <span className="muted">
            {barberName ? `у барбера ${barberName} · ` : ''}
            <time dateTime={dateKey}>{formatDayMonth(dateKey)}</time>
          </span>
        </figcaption>
      </figure>
    </li>
  )
}

type Props = {
  reviews: readonly PublicReviewDto[]
}

export function ReviewsSection({ reviews }: Props) {
  if (reviews.length === 0) return null
  return (
    <section id="reviews" className="section" aria-labelledby="reviews-title">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Отзывы</p>
          <h2 id="reviews-title" className="section-title">
            Что говорят клиенты
          </h2>
        </div>
        <ul className={styles.reviewGrid}>
          {reviews.map((review, index) => (
            <ReviewCard key={review.id} review={review} isFeatured={index === 0} />
          ))}
        </ul>
      </div>
    </section>
  )
}
