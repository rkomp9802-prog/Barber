import type { AdminPortfolioItemDto } from '@barber/shared'
import { AppError } from '../../errors'
import { getBarberRecord } from './barbers'
import type { AdminContext } from './context'
import { toPortfolioDto } from './mappers'

/** POST /barbers/:id/portfolio — фото уже загружено (см. uploads), сохраняем публичный URL. */
export async function addPortfolioItem(
  ctx: AdminContext,
  barberId: string,
  imageUrl: string,
): Promise<AdminPortfolioItemDto> {
  await getBarberRecord(ctx, barberId)
  return toPortfolioDto(await ctx.admin.barbers.addPortfolioItem(barberId, imageUrl))
}

/** DELETE /portfolio/:id. */
export async function deletePortfolioItem(ctx: AdminContext, itemId: string): Promise<void> {
  const removed = await ctx.admin.barbers.deletePortfolioItem(itemId)
  if (!removed) throw new AppError('NOT_FOUND', 'Фото не найдено')
}

function sameIdSet(current: readonly string[], next: readonly string[]): boolean {
  const currentSet = new Set(current)
  return currentSet.size === next.length && next.every(id => currentSet.has(id))
}

/** PUT /barbers/:id/portfolio/order — список должен содержать ровно все фото барбера. */
export async function reorderPortfolio(
  ctx: AdminContext,
  barberId: string,
  itemIds: readonly string[],
): Promise<AdminPortfolioItemDto[]> {
  const barber = await getBarberRecord(ctx, barberId)
  if (!sameIdSet(barber.portfolio.map(item => item.id), itemIds)) {
    throw new AppError('VALIDATION_ERROR', 'Порядок должен содержать все фото барбера и только их')
  }
  const items = await ctx.admin.barbers.reorderPortfolio(barberId, itemIds)
  return items.map(toPortfolioDto)
}
