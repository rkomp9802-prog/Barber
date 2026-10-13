'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { useRouter } from 'next/navigation'

import type { AdminMeDto } from '@barber/shared'

import { me } from '@/lib/adminApi'
import { isApiRequestError } from '@/lib/api'
import { errorMessage } from '@/lib/apiErrors'
import { loginHref } from '@/lib/admin/nextPath'

import { AdminSessionContext } from './AdminSessionContext'
import { AdminSkeleton, ErrorBlock } from './StateBlocks'

type GuardState =
  | { status: 'loading' }
  | { status: 'ready'; session: AdminMeDto }
  | { status: 'error'; message: string }

type Props = {
  children: ReactNode
}

/** Проверяет сессию перед показом раздела: нет сессии — на вход с возвратом; сбой сети — ошибка с повтором. */
export function AdminGuard({ children }: Props) {
  const router = useRouter()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<GuardState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    me().then(
      session => {
        if (current) setState({ status: 'ready', session })
      },
      (error: unknown) => {
        if (!current) return
        if (isApiRequestError(error, 'UNAUTHORIZED')) {
          router.replace(loginHref(window.location.pathname))
          return
        }
        setState({ status: 'error', message: errorMessage(error) })
      },
    )
    return () => {
      current = false
    }
  }, [attempt, router])

  if (state.status === 'loading') return <AdminSkeleton />
  if (state.status === 'error') {
    return <ErrorBlock message={state.message} onRetry={() => setAttempt(value => value + 1)} />
  }
  return <AdminSessionContext.Provider value={state.session}>{children}</AdminSessionContext.Provider>
}
