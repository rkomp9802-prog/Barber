import type { FastifyRequest } from 'fastify'
import { z } from 'zod'

const idParamsSchema = z.object({ id: z.string().uuid() })

/** Достаёт :id из пути (uuid). Неверный формат → 422 VALIDATION_ERROR. */
export function paramId(request: FastifyRequest): string {
  return idParamsSchema.parse(request.params).id
}
