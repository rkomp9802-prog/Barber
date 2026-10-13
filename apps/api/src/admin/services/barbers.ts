import type { AdminBarberDto, AdminDeleteResult } from '@barber/shared'
import type { z } from 'zod'
import { requireFound, type AdminContext } from './context'
import type { AdminBarberRecord } from '../repositories/types'
import { adminBarberCreateSchema, adminBarberUpdateSchema } from '@barber/shared'
import { toBarberDto } from './mappers'

export type BarberCreate = z.infer<typeof adminBarberCreateSchema>
export type BarberUpdate = z.infer<typeof adminBarberUpdateSchema>

/** Барбер по id или NOT_FOUND. Нужен сервисам, которые работают с его связанными данными. */
export async function getBarberRecord(ctx: AdminContext, id: string): Promise<AdminBarberRecord> {
  return requireFound(await ctx.admin.barbers.findById(id), 'Барбер не найден')
}

export async function listBarbers(ctx: AdminContext): Promise<AdminBarberDto[]> {
  const barbers = await ctx.admin.barbers.list()
  return barbers.map(toBarberDto)
}

export async function getBarber(ctx: AdminContext, id: string): Promise<AdminBarberDto> {
  return toBarberDto(await getBarberRecord(ctx, id))
}

export async function createBarber(ctx: AdminContext, input: BarberCreate): Promise<AdminBarberDto> {
  return toBarberDto(await ctx.admin.barbers.create({ ...input }))
}

export async function updateBarber(ctx: AdminContext, id: string, patch: BarberUpdate): Promise<AdminBarberDto> {
  const updated = requireFound(await ctx.admin.barbers.update(id, { ...patch }), 'Барбер не найден')
  return toBarberDto(updated)
}

/** DELETE: барбер остаётся в истории записей, поэтому только скрываем (is_active=false). */
export async function deactivateBarber(ctx: AdminContext, id: string): Promise<AdminDeleteResult> {
  requireFound(await ctx.admin.barbers.update(id, { isActive: false }), 'Барбер не найден')
  return { mode: 'deactivated' }
}
