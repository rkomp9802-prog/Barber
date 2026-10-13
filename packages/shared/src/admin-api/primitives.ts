import { z } from 'zod'

/** Общие примитивы схем админки (не экспортируются из пакета). */

export const uuid = z.string().uuid()
export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
export const isoDateTime = z.string().datetime({ offset: true })
export const uzPhone = z.string().regex(/^\+998\d{9}$/, 'Телефон в формате +998XXXXXXXXX')
export const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine(value => value.startsWith('https://'), 'Нужна ссылка https://')
/** 'HH:MM' по Ташкенту; '24:00' — конец дня (только как время окончания). */
export const hhmmSchema = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Время в формате HH:MM')
export const money = z.number().int().min(0).max(100_000_000)
export const durationMin = z.number().int().min(5).max(480)
export const sortOrder = z.number().int().min(0).max(10_000)

