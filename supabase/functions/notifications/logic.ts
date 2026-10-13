/**
 * Чистая бизнес-логика фоновых уведомлений (этап 8).
 *
 * Здесь нет ни базы данных, ни сети, ни Deno-API: только стандартный JS (Date, Intl).
 * Поэтому модуль одинаково работает в Supabase Edge Runtime (Deno) и в Node (Vitest).
 * Импортируется из jobs.ts и index.ts; тесты — logic.test.ts.
 */

export const DEFAULT_TIMEZONE = 'Asia/Tashkent'

/** Сколько записей обрабатывает одна задача за один запуск (защита от лимитов Telegram и таймаута функции). */
export const BATCH_SIZE = 50

/** Не шлём «напоминание за день», если запись создана меньше чем за 2 часа до визита: клиент и так помнит. */
export const MIN_LEAD_FOR_DAY_REMINDER_MIN = 120

/** Не просим отзыв о визите, который закончился больше 3 суток назад (например, админ отметил его поздно). */
export const REVIEW_MAX_AGE_MIN = 3 * 24 * 60

const MS_IN_MINUTE = 60_000
const MIN_SECRET_LENGTH = 16
export const RATING_VALUES: readonly number[] = [1, 2, 3, 4, 5]

// ---------- Настройки ----------

export interface NotificationSettings {
  readonly reminderDayMinutes: number
  readonly reminderShortMinutes: number
  readonly reviewDelayMin: number
  readonly timezone: string
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  reminderDayMinutes: 1440,
  reminderShortMinutes: 30,
  reviewDelayMin: 60,
  timezone: DEFAULT_TIMEZONE,
}

export interface SettingRow {
  readonly key: string
  readonly value: unknown
}

/** jsonb может прийти числом (1440) или строкой ("1440"); всё остальное — берём значение по умолчанию. */
function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

function toTimezone(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('ru-RU', { timeZone: value })
    return value
  } catch {
    return DEFAULT_TIMEZONE
  }
}

export function parseSettings(rows: readonly SettingRow[]): NotificationSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]))
  return {
    reminderDayMinutes: toPositiveInt(byKey.get('reminder_day_minutes'), DEFAULT_SETTINGS.reminderDayMinutes),
    reminderShortMinutes: toPositiveInt(byKey.get('reminder_short_minutes'), DEFAULT_SETTINGS.reminderShortMinutes),
    reviewDelayMin: toPositiveInt(byKey.get('review_delay_min'), DEFAULT_SETTINGS.reviewDelayMin),
    timezone: toTimezone(byKey.get('timezone')),
  }
}

// ---------- Решения: отправлять или пропустить ----------

export type ReminderDecision =
  | 'send'
  | 'skip_no_chat'
  | 'skip_late_booking'
  | 'skip_too_close'
  | 'skip_stale'

export interface ReminderInput {
  readonly chatId: string | null
  readonly createdAt: Date
  readonly startsAt: Date
  readonly endsAt: Date
  readonly now: Date
}

function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_IN_MINUTE
}

/** Напоминание за день. Пропуск тоже помечает запись обработанной — иначе мы бы сканировали её каждые 5 минут. */
export function decideDayReminder(input: ReminderInput, settings: NotificationSettings): ReminderDecision {
  if (!input.chatId) return 'skip_no_chat'
  if (minutesBetween(input.createdAt, input.startsAt) < MIN_LEAD_FOR_DAY_REMINDER_MIN) return 'skip_late_booking'
  // До визита осталось меньше короткого окна: сейчас уйдёт «напоминание за 30 минут», два сообщения подряд не нужны.
  if (minutesBetween(input.now, input.startsAt) <= settings.reminderShortMinutes) return 'skip_too_close'
  return 'send'
}

/** Напоминание за 30 минут. Если запись создана уже внутри окна, клиент только что получил подтверждение. */
export function decideShortReminder(input: ReminderInput, settings: NotificationSettings): ReminderDecision {
  if (!input.chatId) return 'skip_no_chat'
  if (minutesBetween(input.createdAt, input.startsAt) <= settings.reminderShortMinutes) return 'skip_late_booking'
  return 'send'
}

export function decideReviewRequest(input: ReminderInput): ReminderDecision {
  if (!input.chatId) return 'skip_no_chat'
  if (minutesBetween(input.endsAt, input.now) > REVIEW_MAX_AGE_MIN) return 'skip_stale'
  return 'send'
}

// ---------- Форматирование времени (Asia/Tashkent) ----------

/** Ключ дня YYYY-MM-DD в указанном часовом поясе. */
export function dateKeyIn(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** «14:30» */
export function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

/** «сегодня», «завтра» или «понедельник, 13 октября». */
export function formatDayLabel(date: Date, now: Date, timezone: string): string {
  const target = dateKeyIn(date, timezone)
  if (target === dateKeyIn(now, timezone)) return 'сегодня'
  if (target === dateKeyIn(new Date(now.getTime() + 24 * 60 * MS_IN_MINUTE), timezone)) return 'завтра'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

/** plural(3, ['минуту', 'минуты', 'минут']) → «минуты». */
export function plural(count: number, forms: readonly [string, string, string]): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

// ---------- Тексты сообщений ----------

export interface BookingMessageData {
  readonly startsAt: Date
  readonly barberName: string
  readonly services: string | null
}

function servicesLines(services: string | null): readonly string[] {
  return services ? [`Услуги: ${services}`] : []
}

function joinLines(lines: readonly string[]): string {
  return lines.join('\n')
}

export function buildDayReminderText(data: BookingMessageData, now: Date, timezone: string): string {
  const day = formatDayLabel(data.startsAt, now, timezone)
  return joinLines([
    'Напоминаем о записи в барбершоп.',
    '',
    `Когда: ${day} в ${formatTime(data.startsAt, timezone)}`,
    `Барбер: ${data.barberName}`,
    ...servicesLines(data.services),
    '',
    'Если планы изменились, отмените или перенесите запись заранее.',
  ])
}

export function buildShortReminderText(data: BookingMessageData, now: Date, timezone: string): string {
  const minutesLeft = Math.max(1, Math.ceil(minutesBetween(now, data.startsAt)))
  return joinLines([
    `Ваш визит через ${minutesLeft} ${plural(minutesLeft, ['минуту', 'минуты', 'минут'])}.`,
    `Начало в ${formatTime(data.startsAt, timezone)}, барбер: ${data.barberName}.`,
    'Ждём вас!',
  ])
}

export function buildReviewRequestText(barberName: string): string {
  return joinLines([
    'Спасибо, что были у нас!',
    `Оцените, пожалуйста, визит к барберу ${barberName} от 1 до 5.`,
  ])
}

export interface InlineKeyboardButton {
  readonly text: string
  readonly callback_data: string
}

export interface InlineKeyboardMarkup {
  readonly inline_keyboard: readonly (readonly InlineKeyboardButton[])[]
}

/** Кнопки 1–5. callback_data «rate:<bookingId>:<n>» обрабатывает бот (этап отзывов); ≤ 64 байт для uuid. */
export function buildRatingKeyboard(bookingId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      RATING_VALUES.map((n) => ({ text: `${n} ★`, callback_data: `rate:${bookingId}:${n}` })),
    ],
  }
}

// ---------- Ошибки Telegram ----------

/** retry — снять отметку и попробовать в следующий запуск; drop — оставить отметку, повтор не поможет. */
export type FailureAction = 'retry' | 'drop'

/**
 * status = null означает сетевую ошибку/таймаут.
 * 429 (лимит) и 5xx — временные проблемы: повторяем.
 * Остальные 4xx (403 «бот заблокирован», 400 «chat not found») — повтор пришлёт ту же ошибку: не повторяем.
 */
export function classifyTelegramFailure(status: number | null): FailureAction {
  if (status === null) return 'retry'
  if (status === 429 || status >= 500) return 'retry'
  return 'drop'
}

// ---------- Авторизация вызова ----------

/** Сравнение без раннего выхода, чтобы время ответа не подсказывало секрет по символам. */
function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

export function isSecretConfigured(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.length >= MIN_SECRET_LENGTH
}

/** Ожидаем заголовок «Authorization: Bearer <CRON_SECRET>». */
export function isAuthorized(header: string | null, secret: string): boolean {
  if (!header || !header.startsWith('Bearer ')) return false
  return constantTimeEqual(header.slice('Bearer '.length), secret)
}

// ---------- Статистика запуска ----------

export interface JobStats {
  readonly claimed: number
  readonly sent: number
  readonly skipped: number
  readonly retryLater: number
  readonly dropped: number
}

export const EMPTY_STATS: JobStats = { claimed: 0, sent: 0, skipped: 0, retryLater: 0, dropped: 0 }

export type JobOutcome = 'sent' | 'skipped' | 'retryLater' | 'dropped'

/** Иммутабельно добавляет результат одной записи к статистике задачи. */
export function addOutcome(stats: JobStats, outcome: JobOutcome): JobStats {
  return { ...stats, claimed: stats.claimed + 1, [outcome]: stats[outcome] + 1 }
}
