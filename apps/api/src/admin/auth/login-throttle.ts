/**
 * Задержка после неудачных входов по логину (дополнение к лимиту 5/мин на IP).
 * Первые freeAttempts ошибок — без задержки, дальше блокировка растёт вдвое:
 * 30 с, 1 мин, 2 мин … но не больше 15 минут. Успешный вход сбрасывает счётчик.
 *
 * Хранится в памяти процесса: на Vercel у каждого инстанса свой счётчик —
 * для учебного проекта этого достаточно, основная защита — rate limit и Argon2.
 */

export type LoginThrottleOptions = {
  readonly freeAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
  /** Сколько логинов помнить (защита памяти от перебора случайных логинов). */
  readonly maxEntries: number
}

const DEFAULT_OPTIONS: LoginThrottleOptions = {
  freeAttempts: 5,
  baseDelayMs: 30_000,
  maxDelayMs: 15 * 60_000,
  maxEntries: 10_000,
}

type Entry = { readonly failures: number; readonly lastFailureAt: number }

export class LoginThrottle {
  private entries: ReadonlyMap<string, Entry> = new Map()
  private readonly options: LoginThrottleOptions

  constructor(
    private readonly now: () => number,
    options: Partial<LoginThrottleOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /** Сколько мс ещё ждать до следующей попытки (0 — можно). */
  retryAfterMs(login: string): number {
    const entry = this.entries.get(normalize(login))
    if (!entry || entry.failures < this.options.freeAttempts) return 0
    const exponent = entry.failures - this.options.freeAttempts
    const delay = Math.min(this.options.baseDelayMs * 2 ** exponent, this.options.maxDelayMs)
    return Math.max(0, entry.lastFailureAt + delay - this.now())
  }

  recordFailure(login: string): void {
    const key = normalize(login)
    const failures = (this.entries.get(key)?.failures ?? 0) + 1
    const kept = this.entries.size >= this.options.maxEntries ? dropOldest(this.entries) : this.entries
    this.entries = new Map([...kept, [key, { failures, lastFailureAt: this.now() }]])
  }

  recordSuccess(login: string): void {
    const key = normalize(login)
    if (!this.entries.has(key)) return
    this.entries = new Map([...this.entries].filter(([existing]) => existing !== key))
  }
}

function normalize(login: string): string {
  return login.trim().toLowerCase()
}

function dropOldest(entries: ReadonlyMap<string, Entry>): ReadonlyMap<string, Entry> {
  return new Map([...entries].toSorted(([, a], [, b]) => a.lastFailureAt - b.lastFailureAt).slice(1))
}
