/*
 * Крошечный логгер для серверного кода (Server Components). В клиентский бандл не попадает.
 * Пишет предупреждение один раз на ключ, чтобы недоступный API не засорял лог на каждом запросе.
 * Никогда не передавайте сюда manageToken и персональные данные клиента.
 */

const reported = new Set<string>()

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

export function warnOnce(key: string, message: string, error?: unknown): void {
  if (reported.has(key)) return
  reported.add(key)
  const suffix = error === undefined ? '' : ` (${describe(error)})`
  console.warn(`[web] ${message}${suffix}`)
}

/** Только для тестов. */
export function resetServerLogger(): void {
  reported.clear()
}
