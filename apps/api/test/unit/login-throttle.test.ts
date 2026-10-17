import { describe, expect, it } from 'vitest'
import { LoginThrottle, type LoginAttempt, type LoginAttemptStore } from '../../src/admin/auth/login-throttle'

/** Хранилище в памяти; общий экземпляр имитирует общую базу для нескольких инстансов API. */
function memoryStore(): LoginAttemptStore {
  const rows = new Map<string, LoginAttempt>()
  return {
    getLoginAttempt: async login => rows.get(login) ?? null,
    recordLoginFailure: async (login, now, staleBefore) => {
      for (const [key, row] of rows) if (row.lastFailureAt < staleBefore) rows.delete(key)
      rows.set(login, { failures: (rows.get(login)?.failures ?? 0) + 1, lastFailureAt: now })
    },
    clearLoginAttempts: async login => {
      rows.delete(login)
    },
  }
}

describe('LoginThrottle', () => {
  const start = Date.parse('2026-10-17T10:00:00Z')

  it('первые 5 ошибок без задержки, шестая — блокировка 30 с, дальше вдвое', async () => {
    let now = start
    const throttle = new LoginThrottle(memoryStore(), () => new Date(now))
    for (let i = 0; i < 4; i += 1) await throttle.recordFailure('admin')
    expect(await throttle.retryAfterMs('admin')).toBe(0)
    await throttle.recordFailure('admin')
    expect(await throttle.retryAfterMs('admin')).toBe(30_000)
    now += 30_000
    expect(await throttle.retryAfterMs('admin')).toBe(0)
    await throttle.recordFailure('admin')
    expect(await throttle.retryAfterMs('admin')).toBe(60_000)
  })

  it('счётчик общий для разных инстансов: перебор не распределить по серверам', async () => {
    const store = memoryStore()
    const now = () => new Date(start)
    const instances = [new LoginThrottle(store, now), new LoginThrottle(store, now), new LoginThrottle(store, now)]
    for (let i = 0; i < 5; i += 1) await instances[i % 3]!.recordFailure('admin')
    for (const instance of instances) expect(await instance.retryAfterMs('admin')).toBeGreaterThan(0)
  })

  it('логин сравнивается без учёта регистра и пробелов', async () => {
    const throttle = new LoginThrottle(memoryStore(), () => new Date(start))
    for (let i = 0; i < 5; i += 1) await throttle.recordFailure(i % 2 ? ' Admin ' : 'ADMIN')
    expect(await throttle.retryAfterMs('admin')).toBeGreaterThan(0)
  })

  it('задержка не больше 15 минут; успешный вход сбрасывает счётчик', async () => {
    const throttle = new LoginThrottle(memoryStore(), () => new Date(start))
    for (let i = 0; i < 20; i += 1) await throttle.recordFailure('admin')
    expect(await throttle.retryAfterMs('admin')).toBe(15 * 60_000)
    await throttle.recordSuccess('admin')
    expect(await throttle.retryAfterMs('admin')).toBe(0)
  })

  it('через сутки после последней ошибки счётчик забывается', async () => {
    let now = start
    const throttle = new LoginThrottle(memoryStore(), () => new Date(now))
    for (let i = 0; i < 20; i += 1) await throttle.recordFailure('admin')
    now += 24 * 60 * 60_000 + 1
    expect(await throttle.retryAfterMs('admin')).toBe(0)
  })
})
