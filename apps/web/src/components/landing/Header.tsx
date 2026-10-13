import Link from 'next/link'

import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { shop } from '@/data/shop'

import styles from './Header.module.css'

const NAV = [
  { href: '/#services', label: 'Услуги' },
  { href: '/#barbers', label: 'Барберы' },
  { href: '/#reviews', label: 'Отзывы' },
  { href: '/#contacts', label: 'Контакты' },
] as const

type Props = {
  /** На странице записи кнопка «Записаться» не нужна. */
  showCta?: boolean
}

export function Header({ showCta = true }: Props) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.logo} aria-label={`${shop.fullName}, на главную`}>
          <span className={styles.mark} aria-hidden="true" />
          <span>{shop.name}</span>
        </Link>

        <nav className={styles.nav} aria-label="Разделы сайта">
          {NAV.map(item => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <a href={shop.phoneHref} className={styles.phone}>
            {shop.phone}
          </a>
          <ThemeToggle />
          {showCta && (
            <Link href="/book" className="btn btn-primary">
              Записаться
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
