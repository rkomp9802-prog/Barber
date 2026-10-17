/**
 * Реализация NotificationsRepo на PostgreSQL.
 *
 * Почему postgres.js (npm:postgres), а не supabase-js:
 *  - нам нужен атомарный «UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING».
 *    Через REST (PostgREST/supabase-js) такой запрос не выразить без отдельной SQL-функции (RPC);
 *  - postgres.js — чистый JS, официально работает в Supabase Edge Runtime (есть в примерах Supabase),
 *    а SUPABASE_DB_URL Supabase передаёт в каждую Edge Function автоматически;
 *  - значения подставляются как параметры запроса (tagged template), SQL-инъекции невозможны.
 * Версия закреплена, чтобы деплой был воспроизводимым.
 */
import postgres from 'npm:postgres@3.4.5'
import type { NotificationSettings, SettingRow } from './logic.ts'
import type { ClaimedBooking, NotificationsRepo, ReminderKind } from './jobs.ts'

type Sql = ReturnType<typeof postgres>

/** Колонка-отметка для каждой задачи. Имена берутся только из этого словаря, не из внешнего ввода. */
const MARK_COLUMN: Readonly<Record<ReminderKind, string>> = {
  day: 'reminder_day_sent_at',
  short: 'reminder_30m_sent_at',
  review: 'review_requested_at',
}

interface ClaimedRow {
  readonly id: string
  readonly chat_id: string | null
  readonly created_at: Date
  readonly starts_at: Date
  readonly ends_at: Date
  readonly barber_name: string | null
  readonly services: string | null
}

export function connect(databaseUrl: string): Sql {
  // prepare: false — обязательно для пулера Supabase (transaction mode); max: 1 — функция живёт недолго.
  return postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10 })
}

function dueCondition(sql: Sql, kind: ReminderKind, s: NotificationSettings): postgres.PendingQuery<postgres.Row[]> {
  if (kind === 'review') {
    return sql`b.status = 'completed' AND b.ends_at + make_interval(mins => ${s.reviewDelayMin}::int) <= now()`
  }
  const minutes = kind === 'day' ? s.reminderDayMinutes : s.reminderShortMinutes
  return sql`b.status = 'confirmed'
    AND b.starts_at > now()
    AND b.starts_at <= now() + make_interval(mins => ${minutes}::int)`
}

function toClaimed(row: ClaimedRow): ClaimedBooking {
  return {
    id: row.id,
    chatId: row.chat_id,
    createdAt: row.created_at,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    barberName: row.barber_name ?? 'ваш мастер',
    services: row.services,
  }
}

/**
 * Захват пачки: отметка ставится в том же операторе, что и выборка.
 * FOR UPDATE SKIP LOCKED — параллельный запуск пропускает строки, которые сейчас захватываем мы;
 * повторная проверка «IS NULL» в UPDATE — страховка, что строку никто не отметил раньше нас.
 */
async function claim(
  sql: Sql,
  kind: ReminderKind,
  s: NotificationSettings,
  limit: number,
): Promise<ClaimedBooking[]> {
  const mark = sql(MARK_COLUMN[kind])
  const rows = await sql<ClaimedRow[]>`
    WITH due AS (
      SELECT b.id FROM bookings b
      WHERE b.${mark} IS NULL AND ${dueCondition(sql, kind, s)}
      ORDER BY b.starts_at
      LIMIT ${limit}
      FOR UPDATE OF b SKIP LOCKED
    )
    UPDATE bookings AS b
    SET ${mark} = now()
    FROM due
    WHERE b.id = due.id AND b.${mark} IS NULL
    RETURNING
      b.id::text AS id,
      b.created_at, b.starts_at, b.ends_at,
      (SELECT c.telegram_chat_id::text FROM clients c WHERE c.id = b.client_id) AS chat_id,
      (SELECT br.name FROM barbers br WHERE br.id = b.barber_id) AS barber_name,
      (SELECT string_agg(bs.name, ', ' ORDER BY bs.name) FROM booking_services bs WHERE bs.booking_id = b.id) AS services`
  return rows.map(toClaimed)
}

async function autoComplete(sql: Sql, limit: number): Promise<number> {
  const rows = await sql<{ id: string }[]>`
    WITH due AS (
      SELECT id FROM bookings
      WHERE status = 'confirmed' AND ends_at < now()
      ORDER BY ends_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE bookings AS b
    SET status = 'completed', auto_completed_at = now()
    FROM due
    WHERE b.id = due.id AND b.status = 'confirmed'
    RETURNING b.id::text AS id`
  return rows.length
}

async function expireHolds(sql: Sql, limit: number): Promise<number> {
  return sql.begin(async (tx) => {
    const removed = await tx<{ client_id: string }[]>`
      DELETE FROM bookings
      WHERE id IN (
        SELECT id FROM bookings
        WHERE status = 'pending' AND hold_expires_at <= now()
        ORDER BY hold_expires_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING client_id::text AS client_id`
    if (removed.length === 0) return 0
    // Гость с сайта — отдельный клиент на каждую запись: без записей и Telegram он больше не нужен.
    const ids = [...new Set(removed.map((row) => row.client_id))]
    await tx`
      DELETE FROM clients c
      WHERE c.id::text IN ${tx(ids)} AND c.telegram_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.client_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.client_id = c.id)`
    return removed.length
  })
}

export function createRepo(sql: Sql): NotificationsRepo {
  return {
    loadSettings: async () => {
      const keys = ['reminder_day_minutes', 'reminder_short_minutes', 'review_delay_min', 'timezone']
      const rows = await sql<{ key: string; value: unknown }[]>`
        SELECT key, value FROM settings WHERE key IN ${sql(keys)}`
      return rows.map((row): SettingRow => ({ key: row.key, value: row.value }))
    },
    autoComplete: (limit) => autoComplete(sql, limit),
    expireHolds: (limit) => expireHolds(sql, limit),
    claim: (kind, settings, limit) => claim(sql, kind, settings, limit),
    release: async (kind, bookingId) => {
      // Отметку ставил только наш запуск (другие видят NOT NULL и строку не трогают), поэтому снимаем по id.
      const mark = sql(MARK_COLUMN[kind])
      await sql`UPDATE bookings SET ${mark} = NULL WHERE id = ${bookingId}::uuid AND ${mark} IS NOT NULL`
    },
  }
}
