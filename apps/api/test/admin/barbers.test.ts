import type { AdminBarberDto, AdminBarberLinkCodeDto } from '@barber/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { MONDAY, tashkent } from '../fixtures/calendar'
import { IDS, TEST_CONFIG } from '../fakes/seed-state'
import { adminInject, createAdminTestApp, loginCookie, type AdminTestApp } from './harness'

const NOW = tashkent(MONDAY, '09:00')

let t: AdminTestApp | undefined
afterEach(async () => {
  await t?.app.close()
  t = undefined
})

async function start(config: Partial<typeof TEST_CONFIG> = {}): Promise<{ app: AdminTestApp; cookie: string }> {
  t = await createAdminTestApp({ now: NOW, config })
  return { app: t, cookie: await loginCookie(t.app) }
}

const WEEK = [0, 1, 2, 3, 4, 5, 6]

describe('барберы: CRUD', () => {
  it('список включает неактивных и содержит услуги, портфолио и график', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'GET', '/barbers', { cookie })
    expect(res.statusCode).toBe(200)
    const list = res.json<AdminBarberDto[]>()
    expect(list).toHaveLength(3)
    const timur = list.find(barber => barber.id === IDS.timur)
    expect(timur?.services.map(s => s.serviceId).sort()).toEqual([IDS.beard, IDS.haircut].sort())
    expect(timur?.schedule.workingHours).toHaveLength(7)
    expect(timur?.telegramLinked).toBe(false)
  })

  it('POST: короткое имя → 422 VALIDATION_ERROR', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'POST', '/barbers', { cookie, payload: { name: 'A' } })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('POST: неизвестное поле отклоняется (strict)', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'POST', '/barbers', { cookie, payload: { name: 'Нодир', telegramChatId: 1 } })
    expect(res.statusCode).toBe(422)
  })

  it('POST: создаёт барбера с значениями по умолчанию (201)', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'POST', '/barbers', { cookie, payload: { name: 'Нодир' } })
    expect(res.statusCode).toBe(201)
    expect(res.json<AdminBarberDto>()).toMatchObject({ name: 'Нодир', role: 'Барбер', isActive: true, services: [] })
  })

  it('PATCH: фото только по https', async () => {
    const { app, cookie } = await start()
    const insecure = await adminInject(app.app, 'PATCH', `/barbers/${IDS.timur}`, {
      cookie,
      payload: { photoUrl: 'http://cdn.example/a.jpg' },
    })
    expect(insecure.statusCode).toBe(422)
    const ok = await adminInject(app.app, 'PATCH', `/barbers/${IDS.timur}`, {
      cookie,
      payload: { photoUrl: 'https://cdn.example/a.jpg' },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json<AdminBarberDto>().photoUrl).toBe('https://cdn.example/a.jpg')
  })

  it('DELETE: только деактивирует; барбер скрыт с сайта, но остаётся в админке', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'DELETE', `/barbers/${IDS.aziz}`, { cookie })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ mode: 'deactivated' })
    const admin = await adminInject(app.app, 'GET', `/barbers/${IDS.aziz}`, { cookie })
    expect(admin.json<AdminBarberDto>().isActive).toBe(false)
    const site = await app.app.inject({ method: 'GET', url: '/api/v1/barbers' })
    expect(site.json<{ id: string }[]>().map(barber => barber.id)).not.toContain(IDS.aziz)
  })

  it('неизвестный барбер → 404, некорректный id → 422', async () => {
    const { app, cookie } = await start()
    const missing = await adminInject(app.app, 'GET', '/barbers/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', { cookie })
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' })
    const malformed = await adminInject(app.app, 'GET', '/barbers/not-a-uuid', { cookie })
    expect(malformed.statusCode).toBe(422)
  })
})

describe('барберы: услуги', () => {
  it('PUT services: неизвестная услуга → 422', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'PUT', `/barbers/${IDS.timur}/services`, {
      cookie,
      payload: { services: [{ serviceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', isEnabled: true, durationMin: null, price: null }] },
    })
    expect(res.statusCode).toBe(422)
  })

  it('PUT services: повтор одной услуги → 422 (схема)', async () => {
    const { app, cookie } = await start()
    const link = { serviceId: IDS.haircut, isEnabled: true, durationMin: null, price: null }
    const res = await adminInject(app.app, 'PUT', `/barbers/${IDS.timur}/services`, {
      cookie,
      payload: { services: [link, link] },
    })
    expect(res.statusCode).toBe(422)
  })

  it('PUT services: полный список заменяет связи, переопределения видны как effective-значения', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'PUT', `/barbers/${IDS.timur}/services`, {
      cookie,
      payload: {
        services: [
          { serviceId: IDS.haircut, isEnabled: true, durationMin: 45, price: null },
          { serviceId: IDS.shave, isEnabled: false, durationMin: null, price: 90_000 },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    const services = res.json<AdminBarberDto>().services
    expect(services.map(s => s.serviceId).sort()).toEqual([IDS.haircut, IDS.shave].sort())
    expect(services.find(s => s.serviceId === IDS.haircut)).toMatchObject({ durationMin: 45, effectiveDurationMin: 45, effectivePrice: 120_000 })
    expect(services.find(s => s.serviceId === IDS.shave)).toMatchObject({ isEnabled: false, effectivePrice: 90_000 })
  })
})

describe('барберы: недельный график', () => {
  const shift = (weekday: number, startTime: string, endTime: string) => ({ weekday, startTime, endTime })
  const put = (app: AdminTestApp, cookie: string, payload: unknown) =>
    adminInject(app.app, 'PUT', `/barbers/${IDS.timur}/schedule`, { cookie, payload })

  it('корректный график заменяет старый целиком (200)', async () => {
    const { app, cookie } = await start()
    const workingHours = WEEK.map(weekday => shift(weekday, '09:00', '18:00'))
    const res = await put(app, cookie, { workingHours, breaks: [shift(1, '13:00', '14:00')] })
    expect(res.statusCode).toBe(200)
    const schedule = res.json<AdminBarberDto>().schedule
    expect(schedule.workingHours).toHaveLength(7)
    expect(schedule.breaks).toEqual([shift(1, '13:00', '14:00')])
  })

  it('начало не раньше конца → 422 с указанием строки', async () => {
    const { app, cookie } = await start()
    const res = await put(app, cookie, { workingHours: [shift(1, '18:00', '09:00')], breaks: [] })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path: 'workingHours.0' }] })
  })

  it('пересекающиеся смены одного дня → 422', async () => {
    const { app, cookie } = await start()
    const res = await put(app, cookie, {
      workingHours: [shift(1, '10:00', '14:00'), shift(1, '13:00', '18:00')],
      breaks: [],
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ details: { path: string }[] }>().details.map(d => d.path)).toContain('workingHours.1')
  })

  it('обед вне смены своего дня → 422', async () => {
    const { app, cookie } = await start()
    const res = await put(app, cookie, {
      workingHours: [shift(1, '10:00', '14:00')],
      breaks: [shift(1, '13:30', '14:30')],
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ details: { path: string }[] }>().details).toEqual([expect.objectContaining({ path: 'breaks.0' })])
  })

  it('пересекающиеся обеды одного дня → 422', async () => {
    const { app, cookie } = await start()
    const res = await put(app, cookie, {
      workingHours: [shift(1, '10:00', '20:00')],
      breaks: [shift(1, '13:00', '14:00'), shift(1, '13:30', '14:30')],
    })
    expect(res.statusCode).toBe(422)
  })

  it('время не в формате HH:MM → 422 по схеме', async () => {
    const { app, cookie } = await start()
    const res = await put(app, cookie, { workingHours: [shift(1, '9:00', '18:00')], breaks: [] })
    expect(res.statusCode).toBe(422)
  })
})

describe('барберы: ссылка привязки Telegram', () => {
  it('без TELEGRAM_BOT_USERNAME → 422 с понятным сообщением', async () => {
    const telegram = { ...TEST_CONFIG.telegram, botUsername: undefined }
    const { app, cookie } = await start({ telegram })
    const res = await adminInject(app.app, 'POST', `/barbers/${IDS.timur}/link-code`, { cookie })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ message: string }>().message).toContain('TELEGRAM_BOT_USERNAME')
    expect(app.state.linkCodes).toHaveLength(0)
  })

  it('с ботом выдаёт код и deep link barber_<code>, код сохранён', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'POST', `/barbers/${IDS.timur}/link-code`, { cookie })
    expect(res.statusCode).toBe(200)
    const body = res.json<AdminBarberLinkCodeDto>()
    expect(body.link).toBe(`https://t.me/sharp_test_bot?start=barber_${body.code}`)
    expect(body.expiresAt).toBe(new Date(NOW + 24 * 60 * 60 * 1000).toISOString())
    expect(app.state.linkCodes).toEqual([expect.objectContaining({ code: body.code, barberId: IDS.timur })])
  })

  it('новый код отменяет старый неиспользованный', async () => {
    const { app, cookie } = await start()
    await adminInject(app.app, 'POST', `/barbers/${IDS.timur}/link-code`, { cookie })
    const second = await adminInject(app.app, 'POST', `/barbers/${IDS.timur}/link-code`, { cookie })
    expect(app.state.linkCodes.map(item => item.code)).toEqual([second.json<AdminBarberLinkCodeDto>().code])
  })

  it('неизвестный барбер → 404 и код не создаётся', async () => {
    const { app, cookie } = await start()
    const res = await adminInject(app.app, 'POST', '/barbers/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/link-code', { cookie })
    expect(res.statusCode).toBe(404)
    expect(app.state.linkCodes).toHaveLength(0)
  })
})
