import type { Metadata } from 'next'
import Link from 'next/link'

import { Header } from '@/components/landing/Header'

export const metadata: Metadata = {
  title: 'Страница не найдена',
  robots: { index: false },
}

/** 404 для всего сайта, в том числе для /booking/<токен>, если запись не нашлась. */
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="container section">
        <div className="section-head">
          <p className="eyebrow">Ошибка 404</p>
          <h1 className="section-title">Такой страницы нет</h1>
          <p className="muted">
            Возможно, ссылка устарела или в адресе опечатка. Если вы открыли ссылку на запись, проверьте, что
            скопировали её целиком.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/book" className="btn btn-primary btn-lg">
            Записаться онлайн
          </Link>
          <Link href="/" className="btn btn-ghost btn-lg">
            На главную
          </Link>
        </div>
      </main>
    </>
  )
}
