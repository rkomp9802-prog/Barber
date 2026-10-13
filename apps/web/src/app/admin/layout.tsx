import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/** Админка не для поисковиков: noindex на весь раздел /admin. Лендинговый Header сюда не выводится. */
export const metadata: Metadata = {
  title: 'Админка — Барбершоп',
  robots: { index: false, follow: false },
}

type Props = {
  children: ReactNode
}

export default function AdminLayout({ children }: Props) {
  return children
}
