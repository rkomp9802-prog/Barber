import { isInsideTelegram } from '../telegram'

/** Подсказка для разработки: приложение открыто в обычном браузере, без initData. */
export function DevBanner() {
  if (isInsideTelegram()) return null
  return (
    <div className="dev-banner" role="note">
      Режим разработки: открыто вне Telegram. Запись работает, «Мои записи» — только внутри Telegram.
    </div>
  )
}
