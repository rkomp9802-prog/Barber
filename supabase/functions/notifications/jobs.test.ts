import { describe, expect, it } from 'vitest'
import { runAllJobs, type ClaimedBooking, type JobDeps, type NotificationsRepo, type ReminderKind } from './jobs.ts'
import { createTelegramSender, type OutgoingMessage, type SendResult } from './telegram.ts'

const NOW = new Date('2026-10-11T05:00:00Z')
const at = (offsetMin: number): Date => new Date(NOW.getTime() + offsetMin * 60_000)

function booking(id: string, overrides: Partial<ClaimedBooking> = {}): ClaimedBooking {
  return {
    id,
    chatId: `chat-${id}`,
    createdAt: at(-3 * 24 * 60),
    startsAt: at(20 * 60),
    endsAt: at(21 * 60),
    barberName: 'Алишер',
    services: 'Стрижка',
    ...overrides,
  }
}

/**
 * Фейковая «база»: хранит отметки как множество id по задачам и, как настоящий claim,
 * возвращает только ещё не отмеченные записи и сразу их отмечает.
 */
function fakeRepo(due: Readonly<Record<ReminderKind, readonly ClaimedBooking[]>>) {
  const marked: Record<ReminderKind, Set<string>> = { day: new Set(), short: new Set(), review: new Set() }
  const released: string[] = []
  const repo: NotificationsRepo = {
    loadSettings: async () => [{ key: 'reminder_short_minutes', value: 30 }],
    autoComplete: async () => 2,
    claim: async (kind, _settings, limit) => {
      const fresh = due[kind].filter((b) => !marked[kind].has(b.id)).slice(0, limit)
      fresh.forEach((b) => marked[kind].add(b.id))
      return fresh
    },
    release: async (kind, id) => {
      marked[kind].delete(id)
      released.push(`${kind}:${id}`)
    },
  }
  return { repo, marked, released }
}

function deps(repo: NotificationsRepo, results: (m: OutgoingMessage) => SendResult, sent: OutgoingMessage[]): JobDeps {
  return {
    repo,
    send: async (message) => {
      sent.push(message)
      return results(message)
    },
    now: () => NOW,
    batchSize: 50,
    logError: () => undefined,
  }
}

const OK: SendResult = { ok: true }

describe('runAllJobs', () => {
  it('sends each reminder once even when the cron runs twice', async () => {
    const { repo } = fakeRepo({ day: [booking('a')], short: [booking('b', { startsAt: at(25) })], review: [booking('c')] })
    const sent: OutgoingMessage[] = []
    const first = await runAllJobs(deps(repo, () => OK, sent))
    const second = await runAllJobs(deps(repo, () => OK, sent))

    expect(first.autoCompleted).toBe(2)
    expect([first.day.sent, first.short.sent, first.review.sent]).toEqual([1, 1, 1])
    expect([second.day.claimed, second.short.claimed, second.review.claimed]).toEqual([0, 0, 0])
    expect(sent).toHaveLength(3)
    expect(sent[2]?.replyMarkup?.inline_keyboard[0]).toHaveLength(5)
  })

  it('marks clients without telegram as handled without sending', async () => {
    const { repo, marked } = fakeRepo({ day: [booking('a', { chatId: null })], short: [], review: [] })
    const sent: OutgoingMessage[] = []
    const summary = await runAllJobs(deps(repo, () => OK, sent))

    expect(summary.day).toMatchObject({ claimed: 1, skipped: 1, sent: 0 })
    expect(marked.day.has('a')).toBe(true)
    expect(sent).toHaveLength(0)
  })

  it('releases the mark on retryable errors and keeps it on 4xx', async () => {
    const { repo, marked, released } = fakeRepo({ day: [booking('retry'), booking('blocked')], short: [], review: [] })
    const results = (m: OutgoingMessage): SendResult =>
      m.chatId === 'chat-retry' ? { ok: false, status: 502, action: 'retry' } : { ok: false, status: 403, action: 'drop' }
    const summary = await runAllJobs(deps(repo, results, []))

    expect(summary.day).toMatchObject({ claimed: 2, retryLater: 1, dropped: 1 })
    expect(released).toEqual(['day:retry'])
    expect(marked.day.has('retry')).toBe(false)
    expect(marked.day.has('blocked')).toBe(true)
  })

  it('keeps running other jobs when one job fails', async () => {
    const { repo } = fakeRepo({ day: [], short: [], review: [booking('c')] })
    const failing: NotificationsRepo = {
      ...repo,
      claim: async (kind, settings, limit) => {
        if (kind === 'day') throw new Error('db down')
        return repo.claim(kind, settings, limit)
      },
    }
    const errors: string[] = []
    const summary = await runAllJobs({ ...deps(failing, () => OK, []), logError: (job) => errors.push(job) })

    expect(summary.failedJobs).toEqual(['day'])
    expect(summary.review.sent).toBe(1)
    expect(errors).toEqual(['day'])
  })

  it('counts a booking as dropped when release itself fails', async () => {
    const { repo } = fakeRepo({ day: [booking('a')], short: [], review: [] })
    const broken: NotificationsRepo = { ...repo, release: async () => Promise.reject(new Error('db down')) }
    const summary = await runAllJobs(deps(broken, () => ({ ok: false, status: null, action: 'retry' }), []))

    expect(summary.day).toMatchObject({ claimed: 1, dropped: 1 })
    expect(summary.failedJobs).toEqual([])
  })
})

describe('createTelegramSender', () => {
  const message: OutgoingMessage = { chatId: '42', text: 'Привет' }

  it('posts JSON to sendMessage and reports success', async () => {
    const calls: { url: string; body: string }[] = []
    const send = createTelegramSender('TOKEN', async (url, init) => {
      calls.push({ url, body: String(init.body) })
      return new Response('{"ok":true}', { status: 200 })
    })

    expect(await send(message)).toEqual({ ok: true })
    expect(calls[0]?.url).toBe('https://api.telegram.org/botTOKEN/sendMessage')
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ chat_id: '42', text: 'Привет' })
  })

  it('classifies HTTP errors', async () => {
    const send = createTelegramSender('T', async () => new Response('{}', { status: 403 }))
    expect(await send(message)).toEqual({ ok: false, status: 403, action: 'drop' })
  })

  it('treats network errors as retryable', async () => {
    const send = createTelegramSender('T', async () => Promise.reject(new TypeError('fetch failed')))
    expect(await send(message)).toEqual({ ok: false, status: null, action: 'retry' })
  })
})
