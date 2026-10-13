import { LoginForm } from '@/components/admin/LoginForm'
import styles from '@/components/admin/Admin.module.css'
import { sanitizeNextPath } from '@/lib/admin/nextPath'

type Props = {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const params = await searchParams
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const nextPath = sanitizeNextPath(rawNext)

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div>
          <p className="eyebrow">Барбершоп</p>
          <h1>Вход в админку</h1>
        </div>
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  )
}
