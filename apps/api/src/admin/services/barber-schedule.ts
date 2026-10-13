import type {
  AdminBarberDto,
  AdminBarberLinkCodeDto,
  AdminBarberServicesInput,
  AdminScheduleInput,
} from '@barber/shared'
import { AppError } from '../../errors'
import { createBarberLinkCode } from '../../telegram/link-codes'
import { validateSchedule } from '../domain/schedule-rules'
import { getBarber, getBarberRecord } from './barbers'
import type { AdminContext } from './context'
import { toLinkCodeDto } from './mappers'

/** PUT /barbers/:id/services — полный список связей барбер ↔ услуга (лишние удаляются). */
export async function replaceBarberServices(
  ctx: AdminContext,
  id: string,
  input: AdminBarberServicesInput,
): Promise<AdminBarberDto> {
  await getBarberRecord(ctx, id)
  const known = new Set((await ctx.admin.services.list()).map(service => service.id))
  const unknown = input.services.filter(link => !known.has(link.serviceId)).map(link => link.serviceId)
  if (unknown.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Есть неизвестные услуги', [{ path: 'services', message: unknown.join(', ') }])
  }
  await ctx.admin.barbers.replaceServices(
    id,
    input.services.map(link => ({
      serviceId: link.serviceId,
      isEnabled: link.isEnabled,
      durationMin: link.durationMin,
      price: link.price,
    })),
  )
  return getBarber(ctx, id)
}

/** PUT /barbers/:id/schedule — график целиком; проверки графика — в domain/schedule-rules. */
export async function replaceBarberSchedule(
  ctx: AdminContext,
  id: string,
  input: AdminScheduleInput,
): Promise<AdminBarberDto> {
  await getBarberRecord(ctx, id)
  const issues = validateSchedule(input)
  if (issues.length > 0) throw new AppError('VALIDATION_ERROR', 'Проверьте график', issues)
  await ctx.admin.barbers.replaceSchedule(id, { workingHours: input.workingHours, breaks: input.breaks })
  return getBarber(ctx, id)
}

/** POST /barbers/:id/link-code — одноразовая ссылка для привязки Telegram барбера (живёт 24 часа). */
export async function issueBarberLinkCode(ctx: AdminContext, id: string): Promise<AdminBarberLinkCodeDto> {
  await getBarberRecord(ctx, id)
  if (!ctx.core.telegramBotUsername) {
    throw new AppError('VALIDATION_ERROR', 'Не задан TELEGRAM_BOT_USERNAME: привязка барберов через бота недоступна')
  }
  const issued = await createBarberLinkCode(ctx.core, id)
  return toLinkCodeDto(issued.code, issued.link, issued.expiresAt)
}
