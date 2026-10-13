import type { ReactNode } from 'react'

import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminShell } from '@/components/admin/AdminShell'

type Props = {
  children: ReactNode
}

/** Разделы после входа: проверка сессии и боковая навигация. Вход находится вне этой группы. */
export default function AdminPanelLayout({ children }: Props) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  )
}
