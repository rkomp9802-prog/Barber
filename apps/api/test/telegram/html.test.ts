import { describe, expect, it } from 'vitest'
import { bold, escapeHtml, link } from '../../src/telegram/html'
import { notificationTexts, texts } from '../../src/telegram/texts'
import { MONDAY, tashkent } from '../fixtures/calendar'
import type { BookingRecord } from '../../src/repositories/types'

const HOSTILE = '<img src=x onerror="alert(1)"> & <b>Тимур</b>'

function booking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    clientId: '66666666-6666-4666-8666-666666666666',
    barberId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    barberName: HOSTILE,
    client: { name: HOSTILE, phone: HOSTILE },
    status: 'confirmed',
    source: 'web',
    startsAt: new Date(tashkent(MONDAY, '10:00')),
    endsAt: new Date(tashkent(MONDAY, '11:00')),
    totalPrice: 120_000,
    totalDurationMin: 60,
    manageToken: 'a'.repeat(43),
    services: [{ serviceId: 'svc-1', name: HOSTILE, durationMin: 60, price: 120_000 }],
    createdAt: new Date(0),
    holdExpiresAt: null,
    ...overrides,
  }
}

/** Вредоносные значения из HOSTILE не попадают в текст как разметка (сам бот использует <b>). */
const NO_RAW_TAGS = /<img|<b>Тимур|<a href="https:\/\/evil/

describe('escapeHtml', () => {
  it('экранирует &, <, >, " и не трогает остальное', () => {
    expect(escapeHtml(`a & b < c > d "e"`)).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;')
    expect(escapeHtml('Тимур — лучший 10:00')).toBe('Тимур — лучший 10:00')
  })

  it('не двойное экранирование: амперсанд экранируется один раз', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
  })

  it('пустая строка остаётся пустой', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('bold и link', () => {
  it('bold экранирует содержимое внутри тега', () => {
    expect(bold(HOSTILE)).toBe('<b>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &lt;b&gt;Тимур&lt;/b&gt;</b>')
  })

  it('link экранирует и адрес (атрибут href), и текст', () => {
    expect(link('x"<y>', 'https://e.test/?q="&')).toBe('<a href="https://e.test/?q=&quot;&amp;">x&quot;&lt;y&gt;</a>')
  })
})

describe('тексты бота: пользовательские данные экранируются', () => {
  it('приветствие с именем из Telegram', () => {
    const text = texts.greeting(HOSTILE)
    expect(text).toContain('Здравствуйте, &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &lt;b&gt;Тимур&lt;/b&gt;!')
    expect(text).not.toMatch(NO_RAW_TAGS)
  })

  it('подтверждение записи клиенту: барбер, услуги, клиент, телефон', () => {
    const text = notificationTexts.clientCreated(booking(), 'Asia/Tashkent')
    expect(text).not.toMatch(NO_RAW_TAGS)
    expect(text).toContain('Барбер: &lt;img')
    expect(text).toContain('Услуги: &lt;img')
  })

  it('уведомление барберу: клиент и телефон экранированы', () => {
    const text = notificationTexts.barberCreated(booking(), 'Asia/Tashkent')
    expect(text).toContain('Клиент: &lt;img')
    expect(text).toContain(', &lt;img')
    expect(text).not.toMatch(NO_RAW_TAGS)
  })

  it('перенос и отмена не выводят сырую разметку', () => {
    const oldStart = new Date(tashkent(MONDAY, '09:00'))
    expect(notificationTexts.barberRescheduled(booking(), oldStart, 'Asia/Tashkent')).not.toMatch(NO_RAW_TAGS)
    expect(notificationTexts.barberCancelled(booking(), 'Asia/Tashkent')).not.toMatch(NO_RAW_TAGS)
    expect(notificationTexts.clientCancelled(booking(), 'Asia/Tashkent')).not.toMatch(NO_RAW_TAGS)
  })

  it('список записей и контакты: URL сайта экранирован', () => {
    expect(texts.contacts('https://x.test/?a="1"')).toContain('https://x.test/?a=&quot;1&quot;')
    expect(texts.barberLinked(HOSTILE)).not.toMatch(NO_RAW_TAGS)
    expect(texts.commentPrompt('https://t.me/bot?start=rv_1"x')).toContain('href="https://t.me/bot?start=rv_1&quot;x"')
  })
})
