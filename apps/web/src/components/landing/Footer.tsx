import { shop } from '@/data/shop'

import styles from './Footer.module.css'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p className={`${styles.brand} reveal`}>{shop.name}</p>
        <div className={styles.meta}>
          <p>{shop.address}</p>
          <a href={shop.phoneHref} className={styles.phone}>
            {shop.phone}
          </a>
          <p>© {year}</p>
        </div>
      </div>
    </footer>
  )
}
