const UZ_COUNTRY_CODE = '998'
const UZ_LOCAL_DIGITS = 9

/** Оставляет только цифры номера после кода страны +998 (максимум 9). */
export function uzLocalDigits(input: string): string {
  const digits = input.replace(/\D/g, '')
  const local = digits.startsWith(UZ_COUNTRY_CODE) ? digits.slice(UZ_COUNTRY_CODE.length) : digits
  return local.slice(0, UZ_LOCAL_DIGITS)
}

/** Маска ввода: «+998 90 123 45 67» (частичный ввод тоже форматируется). */
export function formatUzPhone(input: string): string {
  const local = uzLocalDigits(input)
  const parts = [local.slice(0, 2), local.slice(2, 5), local.slice(5, 7), local.slice(7, 9)].filter(Boolean)
  return ['+998', ...parts].join(' ')
}

export function isValidUzPhone(input: string): boolean {
  return uzLocalDigits(input).length === UZ_LOCAL_DIGITS
}

/** Номер в формате E.164 для отправки на сервер: «+998901234567». */
export function toE164UzPhone(input: string): string {
  return `+${UZ_COUNTRY_CODE}${uzLocalDigits(input)}`
}
