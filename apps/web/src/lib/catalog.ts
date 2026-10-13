import type { BarberDto, PublicReviewDto, ServiceDto } from '@barber/shared'

import { barbers as demoBarbers, reviews as demoReviews, services as demoServices } from '@/data/mock'

import { getBarbers, getPublicReviews, getServices, type RequestOptions } from './api'
import { warnOnce } from './serverLogger'

/*
 * Серверная загрузка публичных данных. Если API недоступен, сайт не падает:
 * берём демо-каталог из src/data/mock.ts (важно для этапов до появления backend).
 */

/** Как часто Next.js перепроверяет каталог (секунды). */
export const CATALOG_REVALIDATE_SEC = 60
/** Не ждём медленный API дольше этого — лучше показать демо-данные. */
const CATALOG_TIMEOUT_MS = 4000

/** 'api' — живые данные; 'demo' — сервер недоступен, показаны демо-данные. */
export type DataSource = 'api' | 'demo'

export type Catalog = {
  services: readonly ServiceDto[]
  barbers: readonly BarberDto[]
  source: DataSource
}

export type ReviewsResult = {
  reviews: readonly PublicReviewDto[]
  source: DataSource
}

function catalogOptions(): RequestOptions {
  return { revalidate: CATALOG_REVALIDATE_SEC, signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS) }
}

export const DEMO_CATALOG: Catalog = { services: demoServices, barbers: demoBarbers, source: 'demo' }

export async function loadCatalog(): Promise<Catalog> {
  try {
    const [services, barbers] = await Promise.all([getServices(catalogOptions()), getBarbers(catalogOptions())])
    return { services, barbers, source: 'api' }
  } catch (error: unknown) {
    warnOnce('catalog', 'API недоступен — показываем демо-каталог', error)
    return DEMO_CATALOG
  }
}

export async function loadPublicReviews(): Promise<ReviewsResult> {
  try {
    return { reviews: await getPublicReviews(catalogOptions()), source: 'api' }
  } catch (error: unknown) {
    warnOnce('reviews', 'API недоступен — показываем демо-отзывы', error)
    return { reviews: demoReviews, source: 'demo' }
  }
}
