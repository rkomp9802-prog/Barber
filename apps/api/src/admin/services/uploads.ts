import type { AdminUploadDto, AdminUploadInput } from '@barber/shared'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { AppError } from '../../errors'
import type { StorageConfig } from '../config'

/** Ограничение времени на запрос подписи к Supabase Storage. */
const SIGN_TIMEOUT_MS = 5_000

const EXTENSION_BY_TYPE: Readonly<Record<AdminUploadInput['contentType'], string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const FOLDER_BY_KIND: Readonly<Record<AdminUploadInput['kind'], string>> = {
  'barber-photo': 'barbers',
  portfolio: 'portfolio',
}

const signResponseSchema = z.object({ url: z.string().min(1).max(4096) })

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

/** Относительный адрес подписи (из ответа Supabase) → абсолютный URL загрузки. */
export function resolveUploadUrl(storage: StorageConfig, signedPath: string): string {
  if (signedPath.startsWith('/storage/v1/')) return `${new URL(storage.url).origin}${signedPath}`
  const normalized = signedPath.startsWith('/') ? signedPath : `/${signedPath}`
  return `${storage.url}/storage/v1${normalized}`
}

export function publicObjectUrl(storage: StorageConfig, path: string): string {
  return `${storage.url}/storage/v1/object/public/${storage.bucket}/${path}`
}

function objectPath(input: AdminUploadInput): string {
  return `${FOLDER_BY_KIND[input.kind]}/${randomUUID()}.${EXTENSION_BY_TYPE[input.contentType]}`
}

/** Просит у Supabase подписанный URL на загрузку (service role — только на сервере). */
async function requestSignedUrl(storage: StorageConfig, path: string, fetchImpl: FetchLike): Promise<string> {
  const signUrl = `${storage.url}/storage/v1/object/upload/sign/${storage.bucket}/${path}`
  const response = await fetchImpl(signUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${storage.serviceRoleKey}`,
      apikey: storage.serviceRoleKey,
      'content-type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(SIGN_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Supabase Storage: подпись загрузки отклонена, статус ${response.status}`)
  const parsed = signResponseSchema.parse(await response.json())
  return resolveUploadUrl(storage, parsed.url)
}

/**
 * POST /admin/uploads: проверяет тип и размер, затем выдаёт подписанный URL и публичный адрес файла.
 * Без настроенного Storage — 422 (загрузка необязательна, фото можно вставить ссылкой).
 */
export async function createUploadTarget(
  storage: StorageConfig | undefined,
  input: AdminUploadInput,
  fetchImpl: FetchLike = fetch,
): Promise<AdminUploadDto> {
  if (!storage) {
    throw new AppError('VALIDATION_ERROR', 'Загрузка файлов не настроена: задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY')
  }
  if (input.size > storage.maxUploadBytes) {
    throw new AppError('VALIDATION_ERROR', 'Файл больше допустимого размера')
  }
  const path = objectPath(input)
  const uploadUrl = await requestSignedUrl(storage, path, fetchImpl)
  return { uploadUrl, path, publicUrl: publicObjectUrl(storage, path) }
}
