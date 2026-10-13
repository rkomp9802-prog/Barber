import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '../apiErrors'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string }

export type AsyncResult<T> = {
  state: AsyncState<T>
  reload: () => void
}

/**
 * Загружает данные при монтировании и при изменении deps; устаревший ответ игнорируется,
 * поэтому быстрые смены фильтров не перетирают более свежие данные.
 */
export function useAsyncData<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncResult<T> {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    load().then(
      data => {
        if (current) setState({ status: 'ready', data })
      },
      (error: unknown) => {
        if (current) setState({ status: 'error', message: errorMessage(error) })
      },
    )
    return () => {
      current = false
    }
    // Список зависимостей задаёт вызывающий код: load намеренно не входит в него.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, ...deps])

  const reload = useCallback(() => setAttempt(value => value + 1), [])
  return { state, reload }
}
