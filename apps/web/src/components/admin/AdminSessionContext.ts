import { createContext, useContext } from 'react'

import type { AdminMeDto } from '@barber/shared'

/** Текущий администратор; заполняется в AdminGuard, после которого доступен весь раздел. */
export const AdminSessionContext = createContext<AdminMeDto | null>(null)

export function useAdminSession(): AdminMeDto {
  const session = useContext(AdminSessionContext)
  if (!session) throw new Error('useAdminSession нужно вызывать внутри AdminGuard')
  return session
}
