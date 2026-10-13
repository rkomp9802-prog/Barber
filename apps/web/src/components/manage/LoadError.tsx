import Link from 'next/link'

import { shop } from '@/data/shop'

import styles from './Manage.module.css'

type Props = {
  message: string
}

/** Запись не загрузилась по причине, отличной от «не найдена»: сеть, сервер. */
export function LoadError({ message }: Props) {
  return (
    <section className={styles.stack} aria-labelledby="load-error-title">
      <div className={styles.panel}>
        <h1 id="load-error-title" className={styles.panelTitle}>
          Не удалось открыть запись
        </h1>
        <p className={styles.error} role="alert">
          {message}
        </p>
        <p className="muted">
          Обновите страницу чуть позже или позвоните нам:{' '}
          <a className={styles.link} href={shop.phoneHref}>
            {shop.phone}
          </a>
        </p>
        <div className={styles.actions}>
          <Link href="/" className="btn btn-ghost">
            На главную
          </Link>
        </div>
      </div>
    </section>
  )
}
