import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Двойная запись и перенос — напрямую через API (интерфейс для этого не нужен).
 * Записи ставятся на конец ближайшего свободного дня и в конце отменяются.
 */
const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000'
const API = `${API_BASE}/api/v1`
const TIMEZONE = 'Asia/Tashkent'

type Service = { id: string; name: string; durationMin: number }
type Barber = { id: string; name: string; serviceIds: string[] }
type Slot = { startsAt: string; time: string; barberIds: string[] }
type Booking = {
  status: string
  startsAt: string
  endsAt: string
  manageToken: string
  barber: { id: string }
  holdExpiresAt: string | null
}

function todayInTashkent(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
}

async function getJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const response = await request.get(url)
  expect(response.ok(), `GET ${url} → ${response.status()}`).toBe(true)
  return (await response.json()) as T
}

function bookingBody(serviceId: string, barberId: string, startsAt: string, name: string, phone: string) {
  return { serviceIds: [serviceId], barberId, startsAt, client: { name, phone } }
}

test('двойная запись даёт 409; перенос (или отказ от неподтверждённой) освобождает время', async ({ request }) => {
  const services = await getJson<Service[]>(request, `${API}/services`)
  const service = services.find(s => s.name === 'Мужская стрижка') ?? services[0]
  if (!service) throw new Error('каталог услуг пуст')
  const barbers = await getJson<Barber[]>(request, `${API}/barbers`)
  const barber = barbers.find(b => b.serviceIds.includes(service.id))
  expect(barber, 'нет барбера, который делает эту услугу').toBeDefined()
  const base = `serviceIds=${service.id}&barberId=${barber!.id}`

  // Ищем день, где у барбера есть хотя бы два непересекающихся слота.
  const { days } = await getJson<{ days: { date: string; hasSlots: boolean }[] }>(
    request,
    `${API}/availability/days?${base}&from=${todayInTashkent()}&days=14`,
  )
  let date = ''
  let target: Slot | undefined
  let moveTo: Slot | undefined
  for (const day of days.filter(d => d.hasSlots)) {
    const { slots } = await getJson<{ slots: Slot[] }>(request, `${API}/availability?${base}&date=${day.date}`)
    const last = slots.at(-1)
    if (!last) continue
    const lastStart = Date.parse(last.startsAt)
    const earlier = slots.filter(s => Date.parse(s.startsAt) + service.durationMin * 60_000 <= lastStart).at(-1)
    if (earlier) {
      date = day.date
      target = last
      moveTo = earlier
      break
    }
  }
  expect(target && moveTo, 'нет дня с двумя непересекающимися свободными слотами').toBeTruthy()

  const tokens: string[] = []
  try {
    // 1. Два клиента одновременно бронируют одно и то же время.
    const [first, second] = await Promise.all([
      request.post(`${API}/bookings`, {
        data: bookingBody(service.id, barber!.id, target!.startsAt, 'E2E Первый', '+998900000001'),
      }),
      request.post(`${API}/bookings`, {
        data: bookingBody(service.id, barber!.id, target!.startsAt, 'E2E Второй', '+998900000002'),
      }),
    ])
    for (const response of [first, second]) {
      if (response.status() === 201) tokens.push(((await response.json()) as Booking).manageToken)
    }
    const statuses = [first.status(), second.status()].sort()
    expect(statuses, 'ровно одна запись должна пройти, вторая — получить 409').toEqual([201, 409])
    const rejected = first.status() === 409 ? first : second
    expect(((await rejected.json()) as { code: string }).code).toBe('SLOT_TAKEN')

    // 2. Повторная попытка на занятое время тоже отклоняется, а слот пропал из доступности.
    const retry = await request.post(`${API}/bookings`, {
      data: bookingBody(service.id, barber!.id, target!.startsAt, 'E2E Третий', '+998900000003'),
    })
    if (retry.status() === 201) tokens.push(((await retry.json()) as Booking).manageToken)
    expect(retry.status()).toBe(409)
    const busy = await getJson<{ slots: Slot[] }>(request, `${API}/availability?${base}&date=${date}`)
    expect(busy.slots.map(s => s.startsAt)).not.toContain(target!.startsAt)

    const token = tokens[0]!
    const created = await getJson<Booking>(request, `${API}/bookings/${token}`)
    if (created.status === 'pending') {
      // 3a. С ботом запись ждёт подтверждения в Telegram: время держится, перенести нельзя, отказ освобождает время.
      expect(created.holdExpiresAt).not.toBeNull()
      const move = await request.post(`${API}/bookings/${token}/reschedule`, { data: { startsAt: moveTo!.startsAt } })
      expect(((await move.json()) as { code: string }).code).toBe('BOOKING_NOT_ACTIVE')
      const discard = await request.post(`${API}/bookings/${token}/cancel`, { data: {} })
      expect(discard.ok()).toBe(true)
      tokens.splice(0, 1)
      const freed = await getJson<{ slots: Slot[] }>(request, `${API}/availability?${base}&date=${date}`)
      expect(freed.slots.map(s => Date.parse(s.startsAt))).toContain(Date.parse(target!.startsAt))
      return
    }

    // 3. Перенос на более раннее время.
    const moved = await request.post(`${API}/bookings/${token}/reschedule`, { data: { startsAt: moveTo!.startsAt } })
    expect(moved.status(), `перенос → ${moved.status()}`).toBe(200)
    const movedBooking = (await moved.json()) as Booking
    expect(Date.parse(movedBooking.startsAt)).toBe(Date.parse(moveTo!.startsAt))
    expect(movedBooking.status).toBe('confirmed')

    // Старое время снова свободно, новое — занято.
    const after = await getJson<{ slots: Slot[] }>(request, `${API}/availability?${base}&date=${date}`)
    const free = after.slots.map(s => Date.parse(s.startsAt))
    expect(free).toContain(Date.parse(target!.startsAt))
    expect(free).not.toContain(Date.parse(moveTo!.startsAt))

    // На новое время второй клиент записаться не может.
    const clash = await request.post(`${API}/bookings`, {
      data: bookingBody(service.id, barber!.id, moveTo!.startsAt, 'E2E Второй', '+998900000002'),
    })
    if (clash.status() === 201) tokens.push(((await clash.json()) as Booking).manageToken)
    expect(clash.status()).toBe(409)
  } finally {
    for (const token of tokens) {
      const response = await request.post(`${API}/bookings/${token}/cancel`, { data: {} })
      expect(response.ok(), `cleanup: отмена ${response.status()}`).toBe(true)
    }
  }
})
