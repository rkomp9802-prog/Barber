/**
 * Оркестрация задач одного запуска: автозавершение, напоминание за день, за 30 минут, запрос отзыва.
 *
 * Доступ к БД скрыт за интерфейсом NotificationsRepo (реализация — db.ts на postgres.js),
 * отправка — за SendMessage (telegram.ts). Поэтому модуль тестируется в Node с заглушками.
 *
 * Схема каждой задачи «claim → send»:
 *   1. repo.claim() атомарно ставит отметку (например, reminder_day_sent_at = now()) и возвращает
 *      захваченные записи. Параллельный запуск их уже не увидит (IS NULL + FOR UPDATE SKIP LOCKED).
 *   2. Для каждой записи решаем: отправить или пропустить. Пропуск оставляет отметку — запись обработана.
 *   3. Если Telegram ответил 5xx/429 или сеть упала — repo.release() снимает отметку, повтор через 5 минут.
 *      Если 4xx (бот заблокирован, чат не найден) — отметку оставляем: повтор не поможет.
 */
import {
  addOutcome,
  buildDayReminderText,
  buildRatingKeyboard,
  buildReviewRequestText,
  buildShortReminderText,
  decideDayReminder,
  decideReviewRequest,
  decideShortReminder,
  EMPTY_STATS,
  type JobOutcome,
  type JobStats,
  type NotificationSettings,
  type ReminderDecision,
  type ReminderInput,
  type SettingRow,
  parseSettings,
} from './logic.ts'
import type { OutgoingMessage, SendMessage } from './telegram.ts'

export type ReminderKind = 'day' | 'short' | 'review'

export interface ClaimedBooking {
  readonly id: string
  readonly chatId: string | null
  readonly createdAt: Date
  readonly startsAt: Date
  readonly endsAt: Date
  readonly barberName: string
  readonly services: string | null
}

export interface NotificationsRepo {
  loadSettings(): Promise<readonly SettingRow[]>
  /** confirmed + ends_at < now() → completed. Возвращает число завершённых записей. */
  autoComplete(limit: number): Promise<number>
  /**
   * Неподтверждённые записи с сайта (pending), срок которых прошёл, удаляются вместе с их гостевыми
   * клиентами, если у тех не осталось записей. Возвращает число удалённых записей.
   */
  expireHolds(limit: number): Promise<number>
  claim(kind: ReminderKind, settings: NotificationSettings, limit: number): Promise<readonly ClaimedBooking[]>
  /** Снять отметку, чтобы следующий запуск попробовал снова. */
  release(kind: ReminderKind, bookingId: string): Promise<void>
}

export interface JobDeps {
  readonly repo: NotificationsRepo
  readonly send: SendMessage
  readonly now: () => Date
  readonly batchSize: number
  readonly logError: (job: string, error: unknown) => void
}

export interface RunSummary {
  readonly expiredHolds: number
  readonly autoCompleted: number
  readonly day: JobStats
  readonly short: JobStats
  readonly review: JobStats
  readonly failedJobs: readonly string[]
}

interface JobDefinition {
  decide(input: ReminderInput, settings: NotificationSettings): ReminderDecision
  build(booking: ClaimedBooking, chatId: string, now: Date, settings: NotificationSettings): OutgoingMessage
}

const JOBS: Readonly<Record<ReminderKind, JobDefinition>> = {
  day: {
    decide: decideDayReminder,
    build: (b, chatId, now, s) => ({ chatId, text: buildDayReminderText(b, now, s.timezone) }),
  },
  short: {
    decide: decideShortReminder,
    build: (b, chatId, now, s) => ({ chatId, text: buildShortReminderText(b, now, s.timezone) }),
  },
  review: {
    decide: (input) => decideReviewRequest(input),
    build: (b, chatId) => ({
      chatId,
      text: buildReviewRequestText(b.barberName),
      replyMarkup: buildRatingKeyboard(b.id),
    }),
  },
}

async function processBooking(
  kind: ReminderKind,
  booking: ClaimedBooking,
  settings: NotificationSettings,
  deps: JobDeps,
): Promise<JobOutcome> {
  const job = JOBS[kind]
  const now = deps.now()
  const decision = job.decide({ ...booking, now }, settings)
  if (decision !== 'send' || booking.chatId === null) return 'skipped'

  const result = await deps.send(job.build(booking, booking.chatId, now, settings))
  if (result.ok) return 'sent'
  if (result.action === 'drop') return 'dropped'

  await deps.repo.release(kind, booking.id)
  return 'retryLater'
}

export async function runReminderJob(
  kind: ReminderKind,
  settings: NotificationSettings,
  deps: JobDeps,
): Promise<JobStats> {
  const claimed = await deps.repo.claim(kind, settings, deps.batchSize)
  let stats = EMPTY_STATS
  // Последовательно, а не Promise.all: так проще уложиться в лимит Telegram (~30 сообщений/сек).
  for (const booking of claimed) {
    stats = addOutcome(stats, await processSafely(kind, booking, settings, deps))
  }
  return stats
}

/** Ошибка одной записи (например, release не дошёл до БД) не должна останавливать остальные. */
async function processSafely(
  kind: ReminderKind,
  booking: ClaimedBooking,
  settings: NotificationSettings,
  deps: JobDeps,
): Promise<JobOutcome> {
  try {
    return await processBooking(kind, booking, settings, deps)
  } catch (error: unknown) {
    deps.logError(kind, error)
    // Отметка осталась стоять: сообщение потеряно, но дубля точно не будет.
    return 'dropped'
  }
}

/** Выполняет задачу; при ошибке логирует её и возвращает fallback, чтобы остальные задачи всё равно отработали. */
async function guarded<T>(name: string, fallback: T, task: () => Promise<T>, deps: JobDeps): Promise<[T, boolean]> {
  try {
    return [await task(), true]
  } catch (error: unknown) {
    deps.logError(name, error)
    return [fallback, false]
  }
}

export async function runAllJobs(deps: JobDeps): Promise<RunSummary> {
  const settings = parseSettings(await deps.repo.loadSettings())
  const [expiredHolds, okExpire] = await guarded('expireHolds', 0, () => deps.repo.expireHolds(deps.batchSize), deps)
  // Сначала автозавершение: так запрос отзыва увидит только что завершённые визиты (с учётом задержки).
  const [autoCompleted, okComplete] = await guarded('autoComplete', 0, () => deps.repo.autoComplete(deps.batchSize), deps)
  const [day, okDay] = await guarded('day', EMPTY_STATS, () => runReminderJob('day', settings, deps), deps)
  const [short, okShort] = await guarded('short', EMPTY_STATS, () => runReminderJob('short', settings, deps), deps)
  const [review, okReview] = await guarded('review', EMPTY_STATS, () => runReminderJob('review', settings, deps), deps)

  const statuses: readonly [string, boolean][] = [
    ['expireHolds', okExpire],
    ['autoComplete', okComplete],
    ['day', okDay],
    ['short', okShort],
    ['review', okReview],
  ]
  const failedJobs = statuses.filter(([, ok]) => !ok).map(([name]) => name)
  return { expiredHolds, autoCompleted, day, short, review, failedJobs }
}
