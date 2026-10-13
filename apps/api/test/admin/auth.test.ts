import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { loadAdminConfig } from '../../src/admin/config'
import { MONDAY, tashkent } from '../fixtures/calendar'
import { ADMIN_LOGIN, ADMIN_PASSWORD, createAdminState } from './fakes'
import { SESSION_COOKIE, adminInject, createAdminTestApp, loginCookie, type AdminTestApp } from './harness'

const NOW = tashkent(MONDAY, '09:00')
const DAY = 24 * 60 * 60 * 1000

let t: AdminTestApp | undefined

afterEach(async () => {
  await t?.app.close()
  t = undefined
})

async function start(now = NOW, admin: Parameters<typeof createAdminTestApp>[0]['admin'] = undefined): Promise<AdminTestApp> {
  t = await createAdminTestApp({ now, admin })
  return t
}

/** Тот же state, но «сейчас» другое: проверяем истечение сессии. */
async function restartAt(app: AdminTestApp, now: number): Promise<AdminTestApp> {
  await app.app.close()
  t = await createAdminTestApp({ now, state: app.state })
  return t
}

function setCookieOf(headers: Record<string, unknown>): string {
  const raw = [headers['set-cookie']].flat()
  const value = raw.find(item => typeof item === 'string' && item.startsWith(`${SESSION_COOKIE}=`))
  if (typeof value !== 'string') throw new Error('нет Set-Cookie сессии')
  return value
}

describe('POST /admin/login', () => {
  it('входит с верным паролем: 200, профиль и httpOnly cookie на 7 дней', async () => {
    const { app } = await start()
    const res = await adminInject(app, 'POST', '/login', { payload: { login: ADMIN_LOGIN, password: ADMIN_PASSWORD } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ login: ADMIN_LOGIN })
    const cookie = setCookieOf(res.headers)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).toContain(`Expires=${new Date(NOW + 7 * DAY).toUTCString()}`)
    expect(cookie).not.toMatch(/Secure/i)
  })

  it('в базе хранится только SHA-256 токена, а не сам токен', async () => {
    const { app, state } = await start()
    const cookie = await loginCookie(app)
    const token = cookie.slice(`${SESSION_COOKIE}=`.length)
    expect(state.sessions).toHaveLength(1)
    const [session] = state.sessions
    expect(session?.tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(JSON.stringify(state.sessions)).not.toContain(token)
  })

  it('неверный пароль → 401 UNAUTHORIZED без cookie', async () => {
    const { app } = await start()
    const res = await adminInject(app, 'POST', '/login', { payload: { login: ADMIN_LOGIN, password: 'wrong-password-1' } })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('неизвестный логин тоже → 401 с тем же текстом', async () => {
    const { app } = await start()
    const res = await adminInject(app, 'POST', '/login', { payload: { login: 'nobody', password: ADMIN_PASSWORD } })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED', message: 'Неверный логин или пароль' })
  })

  it('после пяти неудач вход заблокирован задержкой (429), даже с верным паролем', async () => {
    const { app } = await start(NOW, { loginRateLimitMax: 100 })
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await adminInject(app, 'POST', '/login', { payload: { login: ADMIN_LOGIN, password: 'wrong-password-1' } })
      expect(res.statusCode).toBe(401)
    }
    const blocked = await adminInject(app, 'POST', '/login', { payload: { login: ADMIN_LOGIN, password: ADMIN_PASSWORD } })
    expect(blocked.statusCode).toBe(429)
    expect(blocked.json()).toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('превышение лимита запросов в минуту → 429 RATE_LIMITED', async () => {
    const { app } = await start(NOW, { loginRateLimitMax: 2 })
    const payload = { login: ADMIN_LOGIN, password: 'wrong-password-1' }
    await adminInject(app, 'POST', '/login', { payload })
    await adminInject(app, 'POST', '/login', { payload })
    const res = await adminInject(app, 'POST', '/login', { payload })
    expect(res.statusCode).toBe(429)
    expect(res.json()).toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('невалидное тело (короткий пароль) → 422 VALIDATION_ERROR', async () => {
    const { app } = await start()
    const res = await adminInject(app, 'POST', '/login', { payload: { login: ADMIN_LOGIN, password: 'short' } })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('без CSRF-заголовка → 403 FORBIDDEN', async () => {
    const { app } = await start()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/login',
      payload: { login: ADMIN_LOGIN, password: ADMIN_PASSWORD },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('Origin вне разрешённого списка → 403 даже с CSRF-заголовком', async () => {
    const { app } = await start()
    const res = await adminInject(app, 'POST', '/login', {
      payload: { login: ADMIN_LOGIN, password: ADMIN_PASSWORD },
      headers: { origin: 'https://evil.example' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('сессия и защита маршрутов', () => {
  it('без cookie защищённые маршруты отвечают 401 UNAUTHORIZED', async () => {
    const { app } = await start()
    const res = await adminInject(app, 'GET', '/barbers')
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('испорченная cookie → 401', async () => {
    const { app } = await start()
    const res = await adminInject(app, 'GET', '/services', { cookie: `${SESSION_COOKIE}=не-токен` })
    expect(res.statusCode).toBe(401)
  })

  it('GET /admin/me с сессией возвращает профиль и срок', async () => {
    const { app } = await start()
    const cookie = await loginCookie(app)
    const res = await adminInject(app, 'GET', '/me', { cookie })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ login: ADMIN_LOGIN, sessionExpiresAt: new Date(NOW + 7 * DAY).toISOString() })
  })

  it('logout гасит сессию в базе: после него тот же cookie → 401', async () => {
    const { app, state } = await start()
    const cookie = await loginCookie(app)
    const out = await adminInject(app, 'POST', '/logout', { cookie })
    expect(out.statusCode).toBe(204)
    expect(state.sessions).toHaveLength(0)
    const after = await adminInject(app, 'GET', '/me', { cookie })
    expect(after.statusCode).toBe(401)
  })

  it('без CSRF-заголовка logout → 403, GET без заголовка работает', async () => {
    const { app } = await start()
    const cookie = await loginCookie(app)
    const noHeader = await app.inject({ method: 'POST', url: '/api/v1/admin/logout', headers: { cookie } })
    expect(noHeader.statusCode).toBe(403)
    const getNoHeader = await app.inject({ method: 'GET', url: '/api/v1/admin/me', headers: { cookie } })
    expect(getNoHeader.statusCode).toBe(200)
  })

  it('изменяющий запрос к админке без CSRF-заголовка → 403 даже с сессией', async () => {
    const { app } = await start()
    const cookie = await loginCookie(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/services',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { name: 'Стрижка', durationMin: 30, price: 50_000 },
    })
    expect(res.statusCode).toBe(403)
  })

  it('истёкшая сессия (через 8 дней) → 401', async () => {
    const first = await start()
    const cookie = await loginCookie(first.app)
    const later = await restartAt(first, NOW + 8 * DAY)
    const res = await adminInject(later.app, 'GET', '/me', { cookie })
    expect(res.statusCode).toBe(401)
  })
})

describe('конфигурация cookie', () => {
  it('в production cookie получает Secure, SameSite берётся из окружения', () => {
    const config = loadAdminConfig(['https://site.example'], { NODE_ENV: 'production' })
    expect(config.cookie).toMatchObject({ secure: true, sameSite: 'lax' })
  })

  it('SameSite=None принудительно включает Secure и принимается из окружения', () => {
    const config = loadAdminConfig([], { NODE_ENV: 'development', ADMIN_COOKIE_SAMESITE: 'none' })
    expect(config.cookie).toMatchObject({ secure: true, sameSite: 'none' })
  })

  it('по умолчанию SameSite=lax и без Secure вне production', () => {
    const config = loadAdminConfig([], { NODE_ENV: 'development' })
    expect(config.cookie).toMatchObject({ secure: false, sameSite: 'lax' })
    expect(config.storage).toBeUndefined()
  })

  it('неверное значение SameSite → исключение при старте', () => {
    expect(() => loadAdminConfig([], { ADMIN_COOKIE_SAMESITE: 'sometimes' })).toThrow(/ADMIN_COOKIE_SAMESITE/)
  })
})

describe('пароли', () => {
  it('в демо-состоянии пароль хранится как Argon2-хеш', async () => {
    const state = await createAdminState()
    expect(state.adminUsers[0]?.passwordHash).toMatch(/^\$argon2id\$/)
  })
})
