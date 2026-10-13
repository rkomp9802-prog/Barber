import { expect, test } from '@playwright/test'

/** Тестовый клиент: запись создаётся на самый конец дня и тут же отменяется. */
const CLIENT_NAME = 'E2E Тест'
const CLIENT_PHONE = '+998 90 000 00 00'
const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000'

test('запись: услуга, барбер, дата и время, подтверждение и отмена', async ({ page, request }) => {
  let manageToken: string | undefined
  let cancelled = false

  try {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('link', { name: 'Записаться онлайн' }).first().click()
    await expect(page).toHaveURL(/\/book$/)

    // Услуга: первая из каталога.
    const serviceStep = page.getByRole('region', { name: 'Что будем делать?' })
    await serviceStep.getByRole('button', { name: /Мужская стрижка/ }).click()
    await expect(serviceStep.getByRole('button', { name: /Мужская стрижка/ })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Далее' }).click()

    // Барбер: первый конкретный мастер (не «Любой свободный»).
    const barberStep = page.getByRole('region', { name: 'Выберите мастера' })
    const barberCard = barberStep.getByRole('button').filter({ hasText: 'опыта' }).first()
    await barberCard.click()
    await expect(barberCard).toHaveAttribute('aria-pressed', 'true')
    // Первая строка карточки — инициал на аватарке, имя идёт следом: берём первую строку длиннее одного символа.
    const barberName = (await barberCard.innerText()).split('\n').map(line => line.trim()).find(line => line.length > 1) ?? ''
    await page.getByRole('button', { name: 'Далее' }).click()

    // Дата: первый доступный день (кнопки закрытых дней disabled).
    const dateStep = page.getByRole('region', { name: 'Когда удобно прийти?' })
    // Пока свободные дни грузятся, все дни выглядят доступными: ждём итог загрузки.
    await expect(dateStep.getByText('Запись открыта на две недели вперёд')).toBeVisible()
    const firstOpenDay = dateStep.getByRole('list', { name: /Ближайшие/ }).getByRole('button', { disabled: false }).first()
    await firstOpenDay.click()
    await expect(firstOpenDay).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Далее' }).click()

    // Время: последний свободный слот дня.
    const timeStep = page.getByRole('region', { name: 'Выберите время' })
    const slots = timeStep.getByRole('list', { name: 'Свободное время' })
    const lastSlot = slots.getByRole('button').last()
    await expect(lastSlot).toBeVisible()
    const slotTime = (await lastSlot.innerText()).trim()
    await lastSlot.click()
    await expect(lastSlot).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Далее' }).click()

    // Контакты.
    const contactsStep = page.getByRole('region', { name: 'Как с вами связаться?' })
    await contactsStep.getByLabel('Имя').fill(CLIENT_NAME)
    await contactsStep.getByLabel('Телефон').fill(CLIENT_PHONE)
    await page.getByRole('button', { name: 'Далее' }).click()

    // Подтверждение: проверяем, что на экране то, что выбрано, и отправляем.
    const confirmStep = page.getByRole('region', { name: 'Проверьте запись' })
    await expect(confirmStep).toContainText(CLIENT_NAME)
    await expect(confirmStep).toContainText(CLIENT_PHONE)
    expect(barberName).not.toBe('')
    await expect(confirmStep).toContainText(barberName)

    const createResponse = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/v1/bookings' &&
        response.ok(),
    )
    await page.getByRole('button', { name: 'Подтвердить запись' }).click()
    const created = (await (await createResponse).json()) as { manageToken: string }
    manageToken = created.manageToken

    // Экран подтверждения: имя в заголовке, время и барбер в деталях, ссылка на управление записью.
    const success = page.getByRole('region', { name: `${CLIENT_NAME}, вы записаны` })
    await expect(success).toBeVisible()
    await expect(success).toContainText(slotTime)
    await expect(success).toContainText(barberName)
    await expect(success.getByRole('link', { name: 'Управлять записью' })).toBeVisible()

    // Отмена через страницу управления записью.
    await success.getByRole('link', { name: 'Управлять записью' }).click()
    await expect(page).toHaveURL(new RegExp(`/booking/${manageToken}$`))
    await page.getByRole('button', { name: 'Отменить запись' }).click()
    await page.getByRole('button', { name: 'Да, отменить' }).click()
    await expect(page.getByText('Эта запись уже не активна')).toBeVisible()

    const afterUi = await request.get(`${API_BASE}/api/v1/bookings/${manageToken}`)
    expect(afterUi.ok()).toBe(true)
    expect(((await afterUi.json()) as { status: string }).status).toBe('cancelled')
    cancelled = true
  } finally {
    // Страховка: если тест упал до отмены, отменяем запись через API, чтобы не оставлять её в базе.
    if (manageToken && !cancelled) {
      const response = await request.post(`${API_BASE}/api/v1/bookings/${manageToken}/cancel`, { data: {} })
      expect(response.ok(), `cleanup: отмена записи через API не прошла (${response.status()})`).toBe(true)
    }
  }
})
