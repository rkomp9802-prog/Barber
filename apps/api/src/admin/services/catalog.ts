import type { AdminDeleteResult, AdminServiceDto, AdminServiceUpdateInput } from '@barber/shared'
import { adminServiceCreateSchema } from '@barber/shared'
import type { z } from 'zod'
import { requireFound, type AdminContext } from './context'
import { toServiceDto } from './mappers'

/** Каталог услуг, включая скрытые (is_active=false). */
export async function listServices(ctx: AdminContext): Promise<AdminServiceDto[]> {
  return (await ctx.admin.services.list()).map(toServiceDto)
}

export type ServiceCreate = z.infer<typeof adminServiceCreateSchema>

export async function createService(ctx: AdminContext, input: ServiceCreate): Promise<AdminServiceDto> {
  return toServiceDto(await ctx.admin.services.create({ ...input }))
}

export async function updateService(
  ctx: AdminContext,
  id: string,
  patch: AdminServiceUpdateInput,
): Promise<AdminServiceDto> {
  const updated = requireFound(await ctx.admin.services.update(id, { ...patch }), 'Услуга не найдена')
  return toServiceDto(updated)
}

/** DELETE: услуга есть в истории записей (снимки), поэтому только скрываем. */
export async function deactivateService(ctx: AdminContext, id: string): Promise<AdminDeleteResult> {
  requireFound(await ctx.admin.services.update(id, { isActive: false }), 'Услуга не найдена')
  return { mode: 'deactivated' }
}
