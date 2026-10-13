import { buildDataCheckString, signInitData } from '../../src/auth/telegram'

export const TEST_BOT_TOKEN = '123456:TEST-token-for-unit-tests'

/** Собирает initData так же, как Telegram: подписывает все поля, кроме hash. */
export function makeInitData(fields: Record<string, string>, token = TEST_BOT_TOKEN): string {
  const params = new URLSearchParams(fields)
  params.set('hash', signInitData(buildDataCheckString(params), token))
  return params.toString()
}
