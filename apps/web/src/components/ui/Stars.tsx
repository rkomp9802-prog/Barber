const MAX_RATING = 5

type Props = {
  rating: number
}

export function Stars({ rating }: Props) {
  const filled = Math.round(rating)
  return (
    <span aria-label={`Оценка ${rating} из ${MAX_RATING}`} role="img" style={{ color: 'var(--accent)', letterSpacing: 2 }}>
      {'★'.repeat(filled)}
      <span style={{ opacity: 0.3 }}>{'★'.repeat(MAX_RATING - filled)}</span>
    </span>
  )
}
