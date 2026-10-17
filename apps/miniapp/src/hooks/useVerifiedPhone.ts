import type { MeDto } from '@barber/shared'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../client'
import { canRequestContact, isInsideTelegram, requestTelegramContact } from '../telegram'

/** Номер доходит до нас через бота (webhook) — ждём его не дольше POLL_MS × POLL_ATTEMPTS. */
const POLL_MS = 1000
const POLL_ATTEMPTS = 15

export type PhoneState =
  /** Вне Telegram (разработка в браузере): номер вводится вручную, сервер всё равно попросит подтверждение. */
  | { readonly status: 'manual' }
  | { readonly status: 'loading' }
  | { readonly status: 'verified'; readonly phone: string }
  | { readonly status: 'unverified'; readonly error?: string }
  | { readonly status: 'waiting' }

const DECLINED = 'Без номера онлайн-запись недоступна. Можно позвонить нам — администратор запишет вас.'
const NOT_RECEIVED =
  'Номер не подтвердился. Онлайн-запись доступна только для номеров Узбекистана (+998) — подробности в чате с ботом.'
const UNSUPPORTED = 'Обновите Telegram: эта версия не умеет делиться номером из приложения.'

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

function fromMe(me: MeDto): PhoneState {
  return me.phoneVerified && me.phone ? { status: 'verified', phone: me.phone } : { status: 'unverified' }
}

/** Подтверждённый в Telegram номер клиента Mini App и кнопка «Поделиться номером». */
export function useVerifiedPhone(): { readonly state: PhoneState; readonly request: () => Promise<void> } {
  const [state, setState] = useState<PhoneState>(() => (isInsideTelegram() ? { status: 'loading' } : { status: 'manual' }))

  useEffect(() => {
    if (!isInsideTelegram()) return
    const controller = new AbortController()
    api.getMe(controller.signal).then(
      me => setState(fromMe(me)),
      () => {
        if (!controller.signal.aborted) setState({ status: 'unverified' })
      },
    )
    return () => controller.abort()
  }, [])

  const request = useCallback(async () => {
    if (!canRequestContact()) {
      setState({ status: 'unverified', error: UNSUPPORTED })
      return
    }
    setState({ status: 'waiting' })
    if (!(await requestTelegramContact())) {
      setState({ status: 'unverified', error: DECLINED })
      return
    }
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      await sleep(POLL_MS)
      try {
        const next = fromMe(await api.getMe())
        if (next.status === 'verified') {
          setState(next)
          return
        }
      } catch {
        // Сеть или сервер — попробуем ещё раз.
      }
    }
    setState({ status: 'unverified', error: NOT_RECEIVED })
  }, [])

  return { state, request }
}
