import { describe, expect, it } from 'vitest'
import {
  addOutcome,
  buildDayReminderText,
  buildRatingKeyboard,
  buildReviewRequestText,
  buildShortReminderText,
  classifyTelegramFailure,
  decideDayReminder,
  decideReviewRequest,
  decideShortReminder,
  DEFAULT_SETTINGS,
  EMPTY_STATS,
  formatDayLabel,
  formatTime,
  isAuthorized,
  isSecretConfigured,
  parseSettings,
  plural,
  type ReminderInput,
} from './logic.ts'

const TZ = 'Asia/Tashkent'
const MIN = 60_000
// 2026-10-11 10:00 по Ташкенту = 05:00 UTC
const NOW = new Date('2026-10-11T05:00:00Z')
const at = (offsetMin: number): Date => new Date(NOW.getTime() + offsetMin * MIN)

function input(overrides: Partial<ReminderInput> = {}): ReminderInput {
  return {
    chatId: '123',
    createdAt: at(-3 * 24 * 60),
    startsAt: at(20 * 60),
    endsAt: at(21 * 60),
    now: NOW,
    ...overrides,
  }
}

describe('parseSettings', () => {
  it('returns defaults for empty rows', () => {
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS)
  })

  it('accepts numbers and numeric strings from jsonb', () => {
    const settings = parseSettings([
      { key: 'reminder_day_minutes', value: 720 },
      { key: 'reminder_short_minutes', value: '45' },
      { key: 'review_delay_min', value: 90 },
      { key: 'timezone', value: 'Europe/Moscow' },
    ])
    expect(settings).toEqual({ reminderDayMinutes: 720, reminderShortMinutes: 45, reviewDelayMin: 90, timezone: 'Europe/Moscow' })
  })

  it('falls back on invalid values', () => {
    const settings = parseSettings([
      { key: 'reminder_day_minutes', value: -5 },
      { key: 'reminder_short_minutes', value: 'abc' },
      { key: 'review_delay_min', value: 1.5 },
      { key: 'timezone', value: 'Not/AZone' },
    ])
    expect(settings).toEqual(DEFAULT_SETTINGS)
  })
})

describe('decideDayReminder', () => {
  it('sends for an ordinary booking', () => {
    expect(decideDayReminder(input(), DEFAULT_SETTINGS)).toBe('send')
  })

  it('skips clients without telegram chat', () => {
    expect(decideDayReminder(input({ chatId: null }), DEFAULT_SETTINGS)).toBe('skip_no_chat')
  })

  it('skips bookings created less than 2 hours before start', () => {
    const late = input({ createdAt: at(-10), startsAt: at(100) })
    expect(decideDayReminder(late, DEFAULT_SETTINGS)).toBe('skip_late_booking')
  })

  it('sends when created exactly 2 hours before start', () => {
    const edge = input({ createdAt: at(-20), startsAt: at(100) })
    expect(decideDayReminder(edge, DEFAULT_SETTINGS)).toBe('send')
  })

  it('skips when the visit is already inside the short window', () => {
    expect(decideDayReminder(input({ startsAt: at(25) }), DEFAULT_SETTINGS)).toBe('skip_too_close')
  })
})

describe('decideShortReminder', () => {
  it('sends for an ordinary booking', () => {
    expect(decideShortReminder(input({ startsAt: at(25) }), DEFAULT_SETTINGS)).toBe('send')
  })

  it('skips clients without telegram chat', () => {
    expect(decideShortReminder(input({ chatId: null }), DEFAULT_SETTINGS)).toBe('skip_no_chat')
  })

  it('skips bookings created inside the short window', () => {
    const fresh = input({ createdAt: at(-5), startsAt: at(20) })
    expect(decideShortReminder(fresh, DEFAULT_SETTINGS)).toBe('skip_late_booking')
  })
})

describe('decideReviewRequest', () => {
  it('sends after a recent visit', () => {
    expect(decideReviewRequest(input({ endsAt: at(-61) }))).toBe('send')
  })

  it('skips clients without telegram chat', () => {
    expect(decideReviewRequest(input({ chatId: null, endsAt: at(-61) }))).toBe('skip_no_chat')
  })

  it('skips visits that ended more than 3 days ago', () => {
    expect(decideReviewRequest(input({ endsAt: at(-4 * 24 * 60) }))).toBe('skip_stale')
  })
})

describe('time formatting in Asia/Tashkent', () => {
  it('formats time with UTC+5 offset', () => {
    expect(formatTime(new Date('2026-10-11T09:30:00Z'), TZ)).toBe('14:30')
  })

  it('labels today and tomorrow by Tashkent calendar day', () => {
    expect(formatDayLabel(new Date('2026-10-11T18:00:00Z'), NOW, TZ)).toBe('сегодня') // 23:00 Ташкент
    expect(formatDayLabel(new Date('2026-10-11T19:30:00Z'), NOW, TZ)).toBe('завтра') // 00:30 следующего дня
  })

  it('uses a full date for later days', () => {
    expect(formatDayLabel(new Date('2026-10-13T09:00:00Z'), NOW, TZ)).toBe('вторник, 13 октября')
  })
})

describe('plural', () => {
  it.each([
    [1, 'минуту'],
    [3, 'минуты'],
    [5, 'минут'],
    [11, 'минут'],
    [21, 'минуту'],
    [24, 'минуты'],
  ])('%i → %s', (count, expected) => {
    expect(plural(count, ['минуту', 'минуты', 'минут'])).toBe(expected)
  })
})

describe('message texts', () => {
  const data = { startsAt: new Date('2026-10-12T09:30:00Z'), barberName: 'Алишер', services: 'Борода, Стрижка' }

  it('builds the day reminder', () => {
    expect(buildDayReminderText(data, NOW, TZ)).toBe(
      [
        'Напоминаем о записи в барбершоп.',
        '',
        'Когда: завтра в 14:30',
        'Барбер: Алишер',
        'Услуги: Борода, Стрижка',
        '',
        'Если планы изменились, отмените или перенесите запись заранее.',
      ].join('\n'),
    )
  })

  it('omits the services line when there are none', () => {
    expect(buildDayReminderText({ ...data, services: null }, NOW, TZ)).not.toContain('Услуги')
  })

  it('builds the 30-minute reminder with minutes left', () => {
    const text = buildShortReminderText({ ...data, startsAt: at(22) }, NOW, TZ)
    expect(text).toBe('Ваш визит через 22 минуты.\nНачало в 10:22, барбер: Алишер.\nЖдём вас!')
  })

  it('never says «через 0 минут»', () => {
    expect(buildShortReminderText({ ...data, startsAt: NOW }, NOW, TZ)).toContain('через 1 минуту')
  })

  it('builds the review request', () => {
    expect(buildReviewRequestText('Алишер')).toContain('визит к барберу Алишер от 1 до 5')
  })

  it('builds rating buttons 1–5 with short callback data', () => {
    const id = '0b7c6d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e'
    const keyboard = buildRatingKeyboard(id)
    const row = keyboard.inline_keyboard[0] ?? []
    expect(row.map((b) => b.callback_data)).toEqual([1, 2, 3, 4, 5].map((n) => `rate:${id}:${n}`))
    expect(row.every((b) => new TextEncoder().encode(b.callback_data).length <= 64)).toBe(true)
  })
})

describe('classifyTelegramFailure', () => {
  it.each([
    [null, 'retry'],
    [429, 'retry'],
    [500, 'retry'],
    [502, 'retry'],
    [400, 'drop'],
    [403, 'drop'],
    [404, 'drop'],
  ] as const)('status %s → %s', (status, expected) => {
    expect(classifyTelegramFailure(status)).toBe(expected)
  })
})

describe('authorization', () => {
  const secret = 'super-secret-value-123'

  it('accepts the exact bearer secret', () => {
    expect(isAuthorized(`Bearer ${secret}`, secret)).toBe(true)
  })

  it.each([null, '', secret, `Bearer ${secret}x`, `Bearer ${secret.slice(0, -1)}`, `Basic ${secret}`])(
    'rejects %s',
    (header) => {
      expect(isAuthorized(header, secret)).toBe(false)
    },
  )

  it('requires a configured secret of at least 16 chars', () => {
    expect(isSecretConfigured(undefined)).toBe(false)
    expect(isSecretConfigured('short')).toBe(false)
    expect(isSecretConfigured(secret)).toBe(true)
  })
})

describe('addOutcome', () => {
  it('counts outcomes without mutating the input', () => {
    const stats = addOutcome(addOutcome(EMPTY_STATS, 'sent'), 'retryLater')
    expect(stats).toEqual({ claimed: 2, sent: 1, skipped: 0, retryLater: 1, dropped: 0 })
    expect(EMPTY_STATS.claimed).toBe(0)
  })
})
