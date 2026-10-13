import { type ApiClient, createApiClient, normalizeBaseUrl } from './api'
import { getInitData } from './telegram'

/** Единственный экземпляр клиента API для приложения. */
export const api: ApiClient = createApiClient({
  baseUrl: normalizeBaseUrl(import.meta.env.VITE_API_URL),
  getInitData,
})
