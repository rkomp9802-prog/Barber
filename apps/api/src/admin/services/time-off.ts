import type { AdminTimeOffDto, AdminTimeOffQuery, AdminTimeOffResultDto } from '@barber/shared'
import type { z } from 'zod'
import { adminTimeOffCreateSchema, adminTimeOffUpdateSchema } from '@barber/shared'
import { AppError } from '../../errors'
import { dayBoundsUtc } from '../../domain/time'
import { loadRules } from '../../services/context'
import { timeOffProblem } from '../domain/time-off-rules'
import { requireFound, type AdminContext } from './context'
import { toBookingDto, toTimeOffDto } from './mappers'
import type { AdminTimeOffData, AdminTimeOffRecord } from '../repositories/types'

export type TimeOffCreate = z.infer<typeof adminTimeOffCreateSchema>
export type TimeOffUpdate = z.infer<typeof adminTimeOffUpdateSchema>

/** Подтверждённые записи, которые попадают в исключение: их решает администратор вручную. */
async function resultFor(ctx: AdminContext, record: AdminTimeOffRecord): Promise<AdminTimeOffResultDto> {
  const conflicts = await ctx.admin.bookings.listConfirmedOverlapping(record.barberId, record.startsAt, record.endsAt)
  return { timeOff: toTimeOffDto(record), conflicts: conflicts.map(toBookingDto) }
}

function assertValid(data: AdminTimeOffData): void {
  const problem = timeOffProblem(data)
  if (problem) throw new AppError('VALIDATION_ERROR', problem)
}

async function assertBarberExists(ctx: AdminContext, barberId: string | null): Promise<void> {
  if (barberId === null) return
  const barber = await ctx.admin.barbers.findById(barberId)
  if (!barber) throw new AppError('VALIDATION_ERROR', 'Барбер не найден')
}

/** GET /time-off: from/to — даты по Ташкенту (включительно), barberId 'shop' — только закрытия салона. */
export async function listTimeOff(ctx: AdminContext, query: AdminTimeOffQuery): Promise<AdminTimeOffDto[]> {
  const rules = await loadRules(ctx.core)
  const records = await ctx.admin.timeOff.list({
    from: query.from ? new Date(dayBoundsUtc(query.from, rules.timezone).start) : undefined,
    to: query.to ? new Date(dayBoundsUtc(query.to, rules.timezone).end) : undefined,
    barberId: query.barberId === undefined ? undefined : query.barberId === 'shop' ? null : query.barberId,
  })
  return records.map(toTimeOffDto)
}

export async function createTimeOff(ctx: AdminContext, input: TimeOffCreate): Promise<AdminTimeOffResultDto> {
  const data: AdminTimeOffData = {
    barberId: input.barberId,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    type: input.type,
    note: input.note,
  }
  assertValid(data)
  await assertBarberExists(ctx, data.barberId)
  return resultFor(ctx, await ctx.admin.timeOff.create(data))
}

export async function updateTimeOff(ctx: AdminContext, id: string, patch: TimeOffUpdate): Promise<AdminTimeOffResultDto> {
  const current = requireFound(await ctx.admin.timeOff.findById(id), 'Исключение не найдено')
  const data: AdminTimeOffData = {
    barberId: patch.barberId === undefined ? current.barberId : patch.barberId,
    startsAt: patch.startsAt === undefined ? current.startsAt : new Date(patch.startsAt),
    endsAt: patch.endsAt === undefined ? current.endsAt : new Date(patch.endsAt),
    type: patch.type ?? current.type,
    note: patch.note === undefined ? current.note : patch.note,
  }
  assertValid(data)
  await assertBarberExists(ctx, data.barberId)
  const updated = requireFound(await ctx.admin.timeOff.update(id, data), 'Исключение не найдено')
  return resultFor(ctx, updated)
}

export async function deleteTimeOff(ctx: AdminContext, id: string): Promise<void> {
  const removed = await ctx.admin.timeOff.delete(id)
  if (!removed) throw new AppError('NOT_FOUND', 'Исключение не найдено')
}
