import { useCallback, useEffect, useRef, useState } from 'react'

import { isAbortError } from '../api'

export type RequestState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: T }

export type RequestResult<T> = RequestState<T> & { reload: () => void }

/**
 * Загружает данные при каждом изменении `key` и отменяет устаревший запрос через AbortController.
 * `key === null` — запрос не нужен (остаётся состояние loading).
 */
export function useRequest<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): RequestResult<T> {
  const [state, setState] = useState<RequestState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (key === null) return undefined
    const controller = new AbortController()
    setState({ status: 'loading' })
    loadRef.current(controller.signal).then(
      data => {
        if (!controller.signal.aborted) setState({ status: 'success', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) setState({ status: 'error', error })
      },
    )
    return () => controller.abort()
  }, [key, attempt])

  const reload = useCallback(() => setAttempt(value => value + 1), [])
  return { ...state, reload }
}
