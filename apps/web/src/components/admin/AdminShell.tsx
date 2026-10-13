'use client'

import { useState, type ReactNode } from 'react'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { logout } from '@/lib/adminApi'
import { isApiRequestError } from '@/lib/api'
import { errorMessage } from '@/lib/apiErrors'
import { ADMIN_NAV_ITEMS, isNavItemActive } from '@/lib/admin/nav'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

import { useAdminSession } from './AdminSessionContext'
import styles from './Admin.module.css'

const LOGIN_PATH = '/admin/login'

type Props = {
  children: ReactNode
}

export function AdminShell({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const session = useAdminSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  async function handleLogout() {
    setBusy(true)
    setLogoutError(null)
    try {
      await logout()
      router.replace(LOGIN_PATH)
    } catch (error: unknown) {
      // Сессия уже истекла — выход завершён, просто возвращаем на вход.
      if (isApiRequestError(error, 'UNAUTHORIZED')) {
        router.replace(LOGIN_PATH)
        return
      }
      setLogoutError(errorMessage(error))
      setBusy(false)
    }
  }

  return (
    <div className={styles.shell}>
      <aside
        id="admin-nav"
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}
        aria-label="Разделы админки"
      >
        <p className={styles.brand}>Барбершоп · Админка</p>
        <nav>
          <ul className={styles.navList}>
            {ADMIN_NAV_ITEMS.map(item => {
              const active = isNavItemActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={`btn btn-ghost ${styles.menuButton}`}
            aria-expanded={menuOpen}
            aria-controls="admin-nav"
            onClick={() => setMenuOpen(open => !open)}
          >
            Меню
          </button>
          <span className={`${styles.userLogin} muted`}>{session.login}</span>
          <div className={styles.topbarActions}>
            <ThemeToggle />
            <button type="button" className="btn btn-ghost" onClick={handleLogout} disabled={busy}>
              Выйти
            </button>
          </div>
        </header>
        {logoutError ? (
          <p role="alert" className={styles.inlineError}>
            {logoutError}
          </p>
        ) : null}
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  )
}
