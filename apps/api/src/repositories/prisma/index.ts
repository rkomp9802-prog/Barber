import type { Db } from '../../db/prisma'
import { PrismaBarberLinkCodeRepository } from '../../telegram/link-codes'
import type { Repositories } from '../types'
import { PrismaBookingRepository } from './bookings'
import { PrismaCatalogRepository } from './catalog'
import { PrismaClientRepository, PrismaReviewRepository, PrismaSettingsRepository } from './people'
import { PrismaScheduleRepository } from './schedule'

/** Набор репозиториев поверх одного PrismaClient. */
export function createPrismaRepositories(db: Db): Repositories {
  return {
    catalog: new PrismaCatalogRepository(db),
    schedule: new PrismaScheduleRepository(db),
    settings: new PrismaSettingsRepository(db),
    bookings: new PrismaBookingRepository(db),
    clients: new PrismaClientRepository(db),
    reviews: new PrismaReviewRepository(db),
    barberLinkCodes: new PrismaBarberLinkCodeRepository(db),
  }
}
