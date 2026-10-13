import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FastifyInstance } from 'fastify'
import { createProductionApp } from '../src/runtime'

/**
 * Точка входа Vercel Function. Приложение создаётся один раз на инстанс
 * и переиспользуется между вызовами (тёплый старт).
 */
let appPromise: Promise<FastifyInstance> | undefined

async function getApp(): Promise<FastifyInstance> {
  appPromise ??= createProductionApp()
    .then(async app => {
      await app.ready()
      return app
    })
    .catch((error: unknown) => {
      // Не кэшируем неудачный старт: следующий вызов попробует снова.
      appPromise = undefined
      throw error
    })
  return appPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getApp()
  app.server.emit('request', req, res)
}
