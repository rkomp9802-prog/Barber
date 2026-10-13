import type {
  AdminReviewDto,
  AdminReviewUpdateInput,
  AdminReviewsQuery,
  AdminSettingsDto,
  AdminSettingsInput,
  Paginated,
  SettingKey,
} from '@barber/shared'
import { DEFAULT_SETTINGS, settingValueSchemas } from '@barber/shared'
import { z } from 'zod'
import { AppError } from '../../errors'
import { requireFound, type AdminContext } from './context'
import { toReviewDto } from './mappers'

/* ---------- Отзывы ---------- */

export async function listReviews(ctx: AdminContext, query: AdminReviewsQuery): Promise<Paginated<AdminReviewDto>> {
  if (query.minRating !== undefined && query.maxRating !== undefined && query.minRating > query.maxRating) {
    throw new AppError('VALIDATION_ERROR', 'minRating не может быть больше maxRating')
  }
  const { items, total } = await ctx.admin.reviews.list({
    barberId: query.barberId,
    isPublic: query.isPublic,
    minRating: query.minRating,
    maxRating: query.maxRating,
    offset: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
  })
  return { items: items.map(toReviewDto), total, page: query.page, pageSize: query.pageSize }
}

export async function updateReview(
  ctx: AdminContext,
  id: string,
  input: AdminReviewUpdateInput,
): Promise<AdminReviewDto> {
  const review = requireFound(await ctx.admin.reviews.setPublic(id, input.isPublic), 'Отзыв не найден')
  return toReviewDto(review)
}

/* ---------- Настройки ---------- */

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[]
const SETTING_SCHEMAS: Readonly<Record<SettingKey, z.ZodType<string | number>>> = settingValueSchemas

/** Значение из базы, если оно проходит проверку диапазона; иначе — значение по умолчанию. */
function valueOrDefault(key: SettingKey, value: unknown): string | number {
  const parsed = SETTING_SCHEMAS[key].safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_SETTINGS[key]
}

/** Все ключи настроек: сохранённые значения или значения по умолчанию. */
export function resolveSettings(raw: Readonly<Record<string, unknown>>): AdminSettingsDto {
  const entries = SETTING_KEYS.map(key => [key, valueOrDefault(key, raw[key])] as const)
  return Object.fromEntries(entries) as AdminSettingsDto
}

export async function getSettings(ctx: AdminContext): Promise<AdminSettingsDto> {
  return resolveSettings(await ctx.admin.settings.getAll())
}

function definedValues(input: AdminSettingsInput): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string | number] => entry[1] !== undefined),
  )
}

/** PUT /settings: только переданные ключи; неизвестные и вне диапазона отсекает схема на входе. */
export async function updateSettings(ctx: AdminContext, input: AdminSettingsInput): Promise<AdminSettingsDto> {
  await ctx.admin.settings.upsertMany(definedValues(input))
  return getSettings(ctx)
}
