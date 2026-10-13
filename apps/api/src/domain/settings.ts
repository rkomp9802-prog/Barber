import { DEFAULT_SETTINGS } from '@barber/shared'
import { z } from 'zod'

/** Настройки, нужные бизнес-логике, в удобном виде. */
export type BookingRules = {
  readonly slotStepMin: number
  readonly minNoticeMin: number
  readonly horizonDays: number
  readonly cancelCutoffMin: number
  readonly timezone: string
  readonly reviewPublicMinRating: number
}

const minutes = (max: number) => z.coerce.number().int().min(0).max(max)

const settingsSchema = z.object({
  slot_step_min: z.coerce.number().int().min(5).max(240).catch(DEFAULT_SETTINGS.slot_step_min),
  min_notice_min: minutes(7 * 24 * 60).catch(DEFAULT_SETTINGS.min_notice_min),
  booking_horizon_days: z.coerce.number().int().min(1).max(365).catch(DEFAULT_SETTINGS.booking_horizon_days),
  cancel_cutoff_min: minutes(7 * 24 * 60).catch(DEFAULT_SETTINGS.cancel_cutoff_min),
  timezone: z
    .string()
    .refine(isKnownTimeZone)
    .catch(DEFAULT_SETTINGS.timezone),
  review_public_min_rating: z.coerce.number().int().min(1).max(5).catch(DEFAULT_SETTINGS.review_public_min_rating),
})

function isKnownTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/**
 * Превращает строки таблицы settings (key → jsonb) в правила.
 * Отсутствующие или испорченные значения заменяются значениями по умолчанию.
 */
export function parseBookingRules(raw: Readonly<Record<string, unknown>>): BookingRules {
  const parsed = settingsSchema.parse({ ...DEFAULT_SETTINGS, ...stripUndefined(raw) })
  return {
    slotStepMin: parsed.slot_step_min,
    minNoticeMin: parsed.min_notice_min,
    horizonDays: parsed.booking_horizon_days,
    cancelCutoffMin: parsed.cancel_cutoff_min,
    timezone: parsed.timezone,
    reviewPublicMinRating: parsed.review_public_min_rating,
  }
}

function stripUndefined(raw: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined && value !== null))
}

export const DEFAULT_RULES: BookingRules = parseBookingRules({})
