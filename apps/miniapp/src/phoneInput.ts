import { formatUzPhone } from '@barber/shared'

const COUNTRY_CODE = '998'
const LOCAL_DIGITS = 9

/**
 * Локальные цифры номера из сырого ввода. Код 998 снимается и у маски «+998 »,
 * и у вставленного поверх маски полного номера («+998 +998901234567»).
 */
function localDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith(COUNTRY_CODE)) digits = digits.slice(COUNTRY_CODE.length)
  if (digits.length > LOCAL_DIGITS && digits.startsWith(COUNTRY_CODE)) digits = digits.slice(COUNTRY_CODE.length)
  return digits.slice(0, LOCAL_DIGITS)
}

/**
 * Новое значение поля телефона с маской «+998 90 123 45 67».
 * Если пользователь стёр только пробел маски, удаляем последнюю цифру — иначе Backspace «застревает».
 */
export function nextPhoneValue(previous: string, raw: string): string {
  const previousDigits = localDigits(previous)
  let digits = localDigits(raw)
  if (raw.length < previous.length && digits === previousDigits) {
    digits = digits.slice(0, -1)
  }
  return digits === '' ? '' : formatUzPhone(`+${COUNTRY_CODE}${digits}`)
}
