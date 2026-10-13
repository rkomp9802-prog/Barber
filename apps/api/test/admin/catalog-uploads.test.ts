import type { AdminServiceDto } from '@barber/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MONDAY, tashkent } from '../fixtures/calendar'
import { IDS } from '../fakes/seed-state'
import { ADMIN_TEST_CONFIG, adminInject, createAdminTestApp, loginCookie, type AdminTestApp } from './harness'

const NOW = tashkent(MONDAY, '09:00')
const STORAGE = {
  url: 'https://proj.supabase.co',
  serviceRoleKey: 'service-role-secret',
  bucket: 'public-media',
  maxUploadBytes: 5 * 1024 * 1024,
} as const

let t: AdminTestApp | undefined
afterEach(async () => {
  await t?.app.close()
  t = undefined
  vi.unstubAllGlobals()
})

async function start(admin: Partial<typeof ADMIN_TEST_CONFIG> = {}): Promise<{ app: AdminTestApp; cookie: string }> {
  t = await createAdminTestApp({ now: NOW, admin })
  return { app: t, cookie: await loginCookie(t.app) }
}

describe('услуги: CRUD', () => {
  it('POST: слишком короткая длительность → 422', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'POST', '/services', {
      cookie,
      payload: { name: 'Стрижка', durationMin: 2, price: 50_000 },
    })
    expect(res.statusCode).toBe(422)
  })

  it('POST создаёт услугу (201), PATCH меняет цену, DELETE скрывает', async () => {
    const { app, cookie } = await start()
    const created = await adminInject(app.app, 'POST', '/services', {
      cookie,
      payload: { name: 'Детская стрижка', durationMin: 30, price: 60_000 },
    })
    expect(created.statusCode).toBe(201)
    const service = created.json<AdminServiceDto>()
    expect(service).toMatchObject({ isActive: true, description: '' })

    const patched = await adminInject(app.app, 'PATCH', `/services/${service.id}`, { cookie, payload: { price: 65_000 } })
    expect(patched.json<AdminServiceDto>().price).toBe(65_000)

    const removed = await adminInject(app.app, 'DELETE', `/services/${service.id}`, { cookie })
    expect(removed.json()).toEqual({ mode: 'deactivated' })
    const site = await app.app.inject({ method: 'GET', url: '/api/v1/services' })
    expect(site.json<{ id: string }[]>().map(item => item.id)).not.toContain(service.id)
  })

  it('PATCH неизвестной услуги → 404', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'PATCH', '/services/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', {
      cookie,
      payload: { price: 1000 },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('портфолио', () => {
  it('фото только https; порядок сохраняется; удаление → 204, повтор → 404', async () => {
    const { app, cookie } = await start()
    const insecure = await adminInject(app.app, 'POST', `/barbers/${IDS.timur}/portfolio`, {
      cookie,
      payload: { imageUrl: 'http://cdn.example/1.jpg' },
    })
    expect(insecure.statusCode).toBe(422)

    const first = await adminInject(app.app, 'POST', `/barbers/${IDS.timur}/portfolio`, {
      cookie,
      payload: { imageUrl: 'https://cdn.example/1.jpg' },
    })
    const second = await adminInject(app.app, 'POST', `/barbers/${IDS.timur}/portfolio`, {
      cookie,
      payload: { imageUrl: 'https://cdn.example/2.jpg' },
    })
    expect(first.statusCode).toBe(201)
    expect(second.json<{ sortOrder: number }>().sortOrder).toBe(1)
    const firstId = first.json<{ id: string }>().id
    const secondId = second.json<{ id: string }>().id

    const reordered = await adminInject(app.app, 'PUT', `/barbers/${IDS.timur}/portfolio/order`, {
      cookie,
      payload: { itemIds: [secondId, firstId] },
    })
    expect(reordered.statusCode).toBe(200)
    expect(reordered.json<{ id: string }[]>().map(item => item.id)).toEqual([secondId, firstId])

    const removed = await adminInject(app.app, 'DELETE', `/portfolio/${firstId}`, { cookie })
    expect(removed.statusCode).toBe(204)
    const again = await adminInject(app.app, 'DELETE', `/portfolio/${firstId}`, { cookie })
    expect(again.statusCode).toBe(404)
  })

  it('порядок с неизвестным фото → 422', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'PUT', `/barbers/${IDS.timur}/portfolio/order`, {
      cookie,
      payload: { itemIds: ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'] },
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('загрузка фото (Supabase Storage)', () => {
  const upload = (app: AdminTestApp, cookie: string, payload: unknown) =>
    adminInject(app.app, 'POST', '/uploads', { cookie, payload })

  it('без SUPABASE_URL / ключа → 422 с подсказкой', async () => {
    const { app, cookie } = await start()
    const res = await upload(app, cookie, { kind: 'barber-photo', contentType: 'image/jpeg', size: 1000 })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ message: string }>().message).toContain('SUPABASE_URL')
  })

  it('тип файла вне jpeg/png/webp → 422', async () => {
    const { app, cookie } = await start({ storage: STORAGE })
    const res = await upload(app, cookie, { kind: 'portfolio', contentType: 'image/gif', size: 1000 })
    expect(res.statusCode).toBe(422)
  })

  it('файл больше допустимого размера → 422', async () => {
    const { app, cookie } = await start({ storage: { ...STORAGE, maxUploadBytes: 1000 } })
    const res = await upload(app, cookie, { kind: 'portfolio', contentType: 'image/png', size: 5000 })
    expect(res.statusCode).toBe(422)
  })

  it('выдаёт подписанный URL и публичный адрес; ключ службы не возвращается клиенту', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      const relative = input.replace('https://proj.supabase.co/storage/v1', '')
      return new Response(JSON.stringify({ url: `${relative}?token=abc` }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { app, cookie } = await start({ storage: STORAGE })
    const res = await upload(app, cookie, { kind: 'barber-photo', contentType: 'image/webp', size: 2000 })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ uploadUrl: string; path: string; publicUrl: string }>()
    expect(body.path).toMatch(/^barbers\/[0-9a-f-]{36}\.webp$/)
    expect(body.uploadUrl).toBe(`https://proj.supabase.co/storage/v1/object/upload/sign/public-media/${body.path}?token=abc`)
    expect(body.publicUrl).toBe(`https://proj.supabase.co/storage/v1/object/public/public-media/${body.path}`)
    expect(res.body).not.toContain('service-role-secret')
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(calledUrl).toBe(`https://proj.supabase.co/storage/v1/object/upload/sign/public-media/${body.path}`)
    expect(JSON.stringify(init.headers)).toContain('Bearer service-role-secret')
  })

  it('отказ Supabase → 500 без деталей ключа', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('denied', { status: 403 })))
    const { app, cookie } = await start({ storage: STORAGE })
    const res = await upload(app, cookie, { kind: 'portfolio', contentType: 'image/jpeg', size: 2000 })
    expect(res.statusCode).toBe(500)
    expect(res.body).not.toContain('service-role-secret')
  })
})
