import { useEffect, useState } from 'react'

import { isAbortError } from '@/lib/api'
import { errorMessage } from '@/lib/apiErrors'

import type { BookingSource, DaysQuery, SlotsQuery } from './bookingSource'
import type { DayOption, SlotOption } from './types'

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string }

export type SlotsState = ResourceState<SlotOption[]>
export type DaysState = ResourceState<DayOption[]>

type Resource<T> = {
  state: ResourceState<T>
  retry: () => void
}

/**
 * Загружает данные и отменяет предыдущий запрос при смене параметров:
 * если быстро переключать дни, ответ для старого дня не перезапишет новый.
 * key — все параметры запроса одной строкой; `load` читается заново при каждой смене key.
 */
function useResource<T>(load: (signal: AbortSignal) => Promise<T>, key: string): Resource<T> {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    load(controller.signal)
      .then(data => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (isAbortError(error) || controller.signal.aborted) return
        setState({ status: 'error', message: errorMessage(error) })
      })
    return () => controller.abort()
    // load пересоздаётся каждый рендер; его параметры целиком входят в key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  return { state, retry: () => setAttempt(count => count + 1) }
}

function queryKey(query: SlotsQuery | DaysQuery): string {
  return JSON.stringify(query)
}

/** Свободное время на день. refreshKey меняют, чтобы перезапросить (например, после SLOT_TAKEN). */
export function useSlots(source: BookingSource, query: SlotsQuery, refreshKey = 0): Resource<SlotOption[]> {
  return useResource(signal => source.fetchSlots(query, signal), `${queryKey(query)}#${refreshKey}`)
}

/** Какие дни из полосы дат вообще имеют свободное время. */
export function useDays(source: BookingSource, query: DaysQuery): Resource<DayOption[]> {
  return useResource(signal => source.fetchDays(query, signal), queryKey(query))
}
