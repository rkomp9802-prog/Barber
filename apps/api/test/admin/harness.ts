import type { FastifyInstance } from 'fastify'
import { vi } from 'vitest'
import { buildApp, type AppHttpConfig } from '../../src/app'
import type { AdminConfig } from '../../src/admin/config'
import { createAdminRoutes } from '../../src/admin/routes'
import type { Notifier } from '../../src/notifications/notifier'
import { TEST_CONFIG } from '../fakes/seed-state'
import {
  ADMIN_LOGIN,
  ADMIN_PASSWORD,
  createAdminMemoryRepositories,
  createAdminState,
  createCoreMemoryRepositories,
  type AdminMemoryState,
} from './fakes'

export const CSRF_HEADERS = { 'x-requested-with': 'barber-admin' } as const
export const SESSION_COOKIE = 'barber_admin_session'

export const ADMIN_TEST_CONFIG: AdminConfig = {
  cookie: { secure: false, sameSite: 'lax', domain: undefined },
  loginRateLimitMax: 50,
  allowedOrigins: ['http://localhost:3000'],
  storage: undefined,
}

/** Уведомления как моки: тесты проверяют, что вызваны при отмене и переносе. */
export function spyNotifier(): Notifier {
  return {
    bookingCreated: vi.fn(async () => undefined),
    bookingCancelled: vi.fn(async () => undefined),
    bookingRescheduled: vi.fn(async () => undefined),
  }
}

export type AdminTestApp = { readonly app: FastifyInstance; readonly state: AdminMemoryState; readonly notifier: Notifier }

export type AdminTestOptions = {
  readonly now: number
  readonly state?: AdminMemoryState
  readonly config?: Partial<AppHttpConfig>
  readonly admin?: Partial<AdminConfig>
  readonly notifier?: Notifier
}

/** Приложение с админкой над in-memory состоянием (без сети и базы). */
export async function createAdminTestApp(options: AdminTestOptions): Promise<AdminTestApp> {
  const state = options.state ?? (await createAdminState())
  const notifier = options.notifier ?? spyNotifier()
  const app = await buildApp({
    config: { ...TEST_CONFIG, ...options.config },
    repos: createCoreMemoryRepositories(state),
    notifier,
    now: () => options.now,
    logger: false,
    extraRoutes: [
      createAdminRoutes({
        repos: createAdminMemoryRepositories(state),
        config: { ...ADMIN_TEST_CONFIG, ...options.admin },
      }),
    ],
  })
  return { app, state, notifier }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Запрос к админскому API. cookie — значение 'barber_admin_session=...' или undefined. */
export function adminInject(
  app: FastifyInstance,
  method: HttpMethod,
  url: string,
  options: { cookie?: string; payload?: unknown; headers?: Record<string, string> } = {},
) {
  return app.inject({
    method,
    url: `/api/v1/admin${url}`,
    headers: { ...CSRF_HEADERS, ...(options.cookie ? { cookie: options.cookie } : {}), ...options.headers },
    payload: options.payload as string | object | undefined,
  })
}

/** Входит под демо-администратором и возвращает значение cookie сессии. */
export async function loginCookie(app: FastifyInstance, password: string = ADMIN_PASSWORD): Promise<string> {
  const res = await adminInject(app, 'POST', '/login', { payload: { login: ADMIN_LOGIN, password } })
  const header = [res.headers['set-cookie']].flat().find(value => typeof value === 'string' && value.startsWith(`${SESSION_COOKIE}=`))
  const match = typeof header === 'string' ? new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(header) : null
  if (!match?.[1]) throw new Error(`Не получили cookie сессии: статус ${res.statusCode}`)
  return `${SESSION_COOKIE}=${match[1]}`
}
