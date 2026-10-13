import { shop } from '@/data/shop'

import styles from './landing.module.css'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <p className={styles.footerBrand}>{shop.fullName}</p>
        <p className="muted">{shop.address}</p>
        <p className="muted">© {year}</p>
      </div>
    </footer>
  )
}
