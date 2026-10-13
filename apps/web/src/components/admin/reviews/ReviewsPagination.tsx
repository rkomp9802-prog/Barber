import { pageCount } from '@/lib/admin/bookingsQuery'

import styles from './reviews.module.css'

type Props = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** Пагинация списка отзывов: подпись «Отзывы 21–40 из 57» и кнопки назад/вперёд. */
export function ReviewsPagination({ page, pageSize, total, onPageChange }: Props) {
  const lastPage = pageCount(total, pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <nav className={styles.pagination} aria-label="Страницы отзывов">
      <span className="muted">{`Отзывы ${from}–${to} из ${total}`}</span>
      <div className={styles.paginationControls}>
        <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Назад
        </button>
        <span className="muted">
          {page} из {lastPage}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд
        </button>
      </div>
    </nav>
  )
}
