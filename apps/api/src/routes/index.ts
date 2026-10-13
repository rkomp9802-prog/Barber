import { API_PREFIX } from '@barber/shared'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { availabilityRoutes } from './availability'
import { bookingRoutes } from './bookings'
import { catalogRoutes } from './catalog'
import { healthRoutes } from './health'
import { reviewRoutes } from './reviews'
import type { RouteDeps } from './types'

/**
 * Плагин маршрутов. Получает общие зависимости (сервисы, настройки Telegram).
 * Точка расширения: админка (/admin/*) и Telegram webhook (/telegram/webhook)
 * добавляются как новые RoutePlugin и передаются в buildApp({ extraRoutes }).
 */
export type RoutePlugin = FastifyPluginAsync<RouteDeps>

/** Публичные маршруты spec §8. */
export const PUBLIC_ROUTES: readonly RoutePlugin[] = [
  healthRoutes,
  catalogRoutes,
  availabilityRoutes,
  bookingRoutes,
  reviewRoutes,
]

/** Регистрирует маршруты под /api/v1; /health дополнительно доступен в корне. */
export async function registerRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
  extraRoutes: readonly RoutePlugin[] = [],
): Promise<void> {
  await app.register(healthRoutes)
  await app.register(
    async api => {
      for (const plugin of [...PUBLIC_ROUTES, ...extraRoutes]) {
        await api.register(plugin, deps)
      }
    },
    { prefix: API_PREFIX },
  )
}
