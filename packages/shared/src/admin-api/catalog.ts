import { z } from 'zod'
import { durationMin, hhmmSchema, httpsUrl, money, sortOrder, uuid } from './primitives'

export { hhmmSchema }

/* ---------- Услуги ---------- */
// GET    /admin/services            → AdminServiceDto[] (включая скрытые, по sortOrder)
// POST   /admin/services            body: AdminServiceCreateInput → 201 AdminServiceDto
// PATCH  /admin/services/:id        body: AdminServiceUpdateInput → AdminServiceDto
// DELETE /admin/services/:id        → AdminDeleteResult (всегда 'deactivated': услуга есть в истории)

export const adminServiceCreateSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).default(''),
  durationMin,
  price: money,
  sortOrder: sortOrder.default(0),
  isActive: z.boolean().default(true),
})
export type AdminServiceCreateInput = z.input<typeof adminServiceCreateSchema>

export const adminServiceUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(1000),
    durationMin,
    price: money,
    sortOrder,
    isActive: z.boolean(),
  })
  .partial()
export type AdminServiceUpdateInput = z.infer<typeof adminServiceUpdateSchema>

export type AdminServiceDto = {
  id: string
  name: string
  description: string
  durationMin: number
  price: number
  isActive: boolean
  sortOrder: number
}

/* ---------- Барберы ---------- */
// GET    /admin/barbers                       → AdminBarberDto[] (включая неактивных)
// GET    /admin/barbers/:id                   → AdminBarberDto
// POST   /admin/barbers                       body: AdminBarberCreateInput → 201 AdminBarberDto
// PATCH  /admin/barbers/:id                   body: AdminBarberUpdateInput (в т.ч. photoUrl) → AdminBarberDto
// DELETE /admin/barbers/:id                   → AdminDeleteResult (всегда 'deactivated': барбер остаётся в истории записей)
// PUT    /admin/barbers/:id/services          body: AdminBarberServicesInput → AdminBarberDto
// PUT    /admin/barbers/:id/schedule          body: AdminScheduleInput → AdminBarberDto
// POST   /admin/barbers/:id/portfolio         body: AdminPortfolioCreateInput → 201 AdminPortfolioItemDto
// DELETE /admin/portfolio/:id                 → 204
// PUT    /admin/barbers/:id/portfolio/order   body: AdminPortfolioOrderInput → AdminPortfolioItemDto[]
// POST   /admin/barbers/:id/link-code         → AdminBarberLinkCodeDto (422 VALIDATION_ERROR без TELEGRAM_BOT_USERNAME)

const barberFields = {
  name: z.string().trim().min(2).max(60),
  role: z.string().trim().max(60),
  bio: z.string().trim().max(1000),
  photoUrl: httpsUrl.nullable(),
  experienceYears: z.number().int().min(0).max(60),
  sortOrder,
  isActive: z.boolean(),
}

export const adminBarberCreateSchema = z.strictObject({
  name: barberFields.name,
  role: barberFields.role.default('Барбер'),
  bio: barberFields.bio.default(''),
  photoUrl: barberFields.photoUrl.default(null),
  experienceYears: barberFields.experienceYears.default(0),
  sortOrder: barberFields.sortOrder.default(0),
  isActive: barberFields.isActive.default(true),
})
export type AdminBarberCreateInput = z.input<typeof adminBarberCreateSchema>

export const adminBarberUpdateSchema = z.strictObject(barberFields).partial()
export type AdminBarberUpdateInput = z.infer<typeof adminBarberUpdateSchema>

export const adminBarberServicesSchema = z.strictObject({
  /** Полный список: услуги, которых нет в списке, у барбера отключаются (связь удаляется). */
  services: z
    .array(
      z.strictObject({
        serviceId: uuid,
        isEnabled: z.boolean(),
        /** null — брать длительность из услуги. */
        durationMin: durationMin.nullable(),
        /** null — брать цену из услуги. */
        price: money.nullable(),
      }),
    )
    .max(100)
    .refine(items => new Set(items.map(item => item.serviceId)).size === items.length, 'Услуги повторяются'),
})
export type AdminBarberServicesInput = z.infer<typeof adminBarberServicesSchema>

export const weeklyRangeSchema = z.strictObject({
  /** 0 = воскресенье … 6 = суббота. */
  weekday: z.number().int().min(0).max(6),
  startTime: hhmmSchema,
  endTime: hhmmSchema,
})
export type WeeklyRangeDto = z.infer<typeof weeklyRangeSchema>

/**
 * Недельный график целиком (заменяет старый). Проверки на сервере:
 * start < end; смены одного дня не пересекаются; каждый обед лежит внутри смены
 * своего дня; обеды не пересекаются. Ошибка — 422 VALIDATION_ERROR с details.
 */
export const adminScheduleSchema = z.strictObject({
  workingHours: z.array(weeklyRangeSchema).max(50),
  breaks: z.array(weeklyRangeSchema).max(50),
})
export type AdminScheduleInput = z.infer<typeof adminScheduleSchema>

export const adminPortfolioCreateSchema = z.strictObject({ imageUrl: httpsUrl })
export type AdminPortfolioCreateInput = z.infer<typeof adminPortfolioCreateSchema>

export const adminPortfolioOrderSchema = z.strictObject({
  /** Все id портфолио барбера в новом порядке. */
  itemIds: z.array(uuid).max(200),
})
export type AdminPortfolioOrderInput = z.infer<typeof adminPortfolioOrderSchema>

export type AdminPortfolioItemDto = { id: string; imageUrl: string; sortOrder: number }

export type AdminBarberServiceDto = {
  serviceId: string
  name: string
  isEnabled: boolean
  /** Переопределение (null — как в услуге). */
  durationMin: number | null
  price: number | null
  /** Итоговые значения с учётом переопределения. */
  effectiveDurationMin: number
  effectivePrice: number
}

export type AdminBarberDto = {
  id: string
  name: string
  role: string
  bio: string
  photoUrl: string | null
  experienceYears: number
  isActive: boolean
  sortOrder: number
  /** Барбер привязал Telegram (получает уведомления). */
  telegramLinked: boolean
  services: AdminBarberServiceDto[]
  portfolio: AdminPortfolioItemDto[]
  schedule: { workingHours: WeeklyRangeDto[]; breaks: WeeklyRangeDto[] }
}

export type AdminBarberLinkCodeDto = {
  code: string
  /** https://t.me/<bot>?start=barber_<code> — открыть барберу. */
  link: string
  expiresAt: string
}

/* ---------- Загрузка файлов (Supabase Storage) ---------- */
// POST /admin/uploads body: AdminUploadInput → AdminUploadDto (422 VALIDATION_ERROR без SUPABASE_URL / ключа)
// Дальше браузер делает PUT uploadUrl с телом-файлом и заголовком content-type,
// затем сохраняет publicUrl через PATCH /admin/barbers/:id { photoUrl } или POST .../portfolio.

export const ADMIN_UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ADMIN_UPLOAD_KINDS = ['barber-photo', 'portfolio'] as const
/** Верхняя граница размера; сервер может быть настроен строже (UPLOAD_MAX_BYTES). */
export const ADMIN_UPLOAD_MAX_BYTES = 5 * 1024 * 1024

export const adminUploadSchema = z.strictObject({
  kind: z.enum(ADMIN_UPLOAD_KINDS),
  contentType: z.enum(ADMIN_UPLOAD_CONTENT_TYPES),
  /** Размер файла в байтах. */
  size: z.number().int().min(1).max(ADMIN_UPLOAD_MAX_BYTES),
})
export type AdminUploadInput = z.infer<typeof adminUploadSchema>

export type AdminUploadDto = {
  /** Подписанный URL: PUT с телом файла. */
  uploadUrl: string
  /** Путь внутри bucket. */
  path: string
  /** Публичный URL файла после загрузки. */
  publicUrl: string
}

