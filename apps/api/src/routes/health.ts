import type { FastifyInstance } from 'fastify'

export type HealthResponse = { status: 'ok'; time: string }

/** GET /health — живой ли сервер (без обращения к базе). */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (): Promise<HealthResponse> => ({ status: 'ok', time: new Date().toISOString() }))
}
