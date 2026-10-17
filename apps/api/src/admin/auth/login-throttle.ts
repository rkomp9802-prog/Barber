/**
 * Задержка после неудачных входов по логину (дополнение к лимиту 5/мин на IP).
 * Первые freeAttempts ошибок — без задержки, дальше блокировка растёт вдвое:
 * 30 с, 1 мин, 2 мин … но не больше 15 минут. Успешный вход сбрасывает счётчик.
 *
 * Счётчик хранится в базе (admin_login_attempts): на Vercel много инстансов, и счётчик
 * в памяти процесса позволял бы распределить перебор пароля по ним.
 */

export type LoginAttempt = { readonly failures: number; readonly lastFailureAt: Date }

/** Хранилище счётчиков. Реализация — AdminAuthRepository (Prisma) или in-memory в тестах. */
export interface LoginAttemptStore {
  getLoginAttempt(login: string): Promise<LoginAttempt | null>
  /** Атомарно: failures + 1, lastFailureAt = now. Заодно удаляет записи старше staleBefore. */
  recordLoginFailure(login: string, now: Date, staleBefore: Date): Promise<void>
  clearLoginAttempts(login: string): Promise<void>
}

export type LoginThrottleOptions = {
  readonly freeAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
  /** Через сколько после последней ошибки счётчик забывается. */
  readonly forgetAfterMs: number
}

const DEFAULT_OPTIONS: LoginThrottleOptions = {
  freeAttempts: 5,
  baseDelayMs: 30_000,
  maxDelayMs: 15 * 60_000,
  forgetAfterMs: 24 * 60 * 60_000,
}

export class LoginThrottle {
  private readonly options: LoginThrottleOptions

  constructor(
    private readonly store: LoginAttemptStore,
    private readonly now: () => Date,
    options: Partial<LoginThrottleOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /** Сколько мс ещё ждать до следующей попытки (0 — можно). */
  async retryAfterMs(login: string): Promise<number> {
    const entry = await this.store.getLoginAttempt(normalize(login))
    const now = this.now().getTime()
    if (!entry || entry.failures < this.options.freeAttempts) return 0
    if (now - entry.lastFailureAt.getTime() > this.options.forgetAfterMs) return 0
    const exponent = entry.failures - this.options.freeAttempts
    const delay = Math.min(this.options.baseDelayMs * 2 ** exponent, this.options.maxDelayMs)
    return Math.max(0, entry.lastFailureAt.getTime() + delay - now)
  }

  async recordFailure(login: string): Promise<void> {
    const now = this.now()
    await this.store.recordLoginFailure(normalize(login), now, new Date(now.getTime() - this.options.forgetAfterMs))
  }

  async recordSuccess(login: string): Promise<void> {
    await this.store.clearLoginAttempts(normalize(login))
  }
}

function normalize(login: string): string {
  return login.trim().toLowerCase()
}
