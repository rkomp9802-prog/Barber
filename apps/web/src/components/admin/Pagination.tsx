import { pageCount } from '@/lib/admin/bookingsQuery'

import styles from './Admin.module.css'

type Props = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** Страница вычисляется из total: подпись «Записи 21–40 из 57» и кнопки назад/вперёд. */
export function Pagination({ page, pageSize, total, onPageChange }: Props) {
  const lastPage = pageCount(total, pageSize)
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <nav className={styles.pagination} aria-label="Страницы">
      <span className="muted">
        {total === 0 ? 'Записей нет' : `Записи ${from}–${to} из ${total}`}
      </span>
      <div className={styles.paginationControls}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
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
