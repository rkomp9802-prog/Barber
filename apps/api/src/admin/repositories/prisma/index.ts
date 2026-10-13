import type { Db } from '../../../db/prisma'
import type { AdminRepositories } from '../types'
import { PrismaAdminAuthRepository } from './auth'
import { PrismaAdminServiceRepository } from './catalog'
import { PrismaAdminBarberRepository } from './barbers'
import { PrismaAdminBookingRepository } from './bookings'
import { PrismaAdminReviewRepository, PrismaAdminSettingsRepository } from './reviews-settings'
import { PrismaAdminTimeOffRepository } from './time-off'

/** Репозитории админки поверх одного PrismaClient. */
export function createPrismaAdminRepositories(db: Db): AdminRepositories {
  return {
    auth: new PrismaAdminAuthRepository(db),
    services: new PrismaAdminServiceRepository(db),
    barbers: new PrismaAdminBarberRepository(db),
    timeOff: new PrismaAdminTimeOffRepository(db),
    bookings: new PrismaAdminBookingRepository(db),
    reviews: new PrismaAdminReviewRepository(db),
    settings: new PrismaAdminSettingsRepository(db),
  }
}
