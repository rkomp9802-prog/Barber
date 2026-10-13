/*
 * Фото барберов лежат в Supabase Storage. next/image оптимизирует только разрешённые хосты
 * (images.remotePatterns в next.config.ts), поэтому и конфиг, и компоненты берут хост отсюда.
 */

/** Публичные файлы Supabase Storage: https://<ref>.supabase.co/storage/v1/object/public/... */
export const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/'

/** Хост Supabase из NEXT_PUBLIC_SUPABASE_URL или null, если переменная не задана/кривая. */
export function storageHost(supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): URL | null {
  if (!supabaseUrl) return null
  try {
    return new URL(supabaseUrl)
  } catch {
    return null
  }
}

/** Можно ли отдать картинку в next/image: только https и только наш storage. */
export function isOptimizableImage(src: string | null, supabaseUrl?: string): src is string {
  const host = storageHost(supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!src || !host) return false
  try {
    const url = new URL(src)
    return url.protocol === host.protocol && url.host === host.host && url.pathname.startsWith(STORAGE_PUBLIC_PATH)
  } catch {
    return false
  }
}
