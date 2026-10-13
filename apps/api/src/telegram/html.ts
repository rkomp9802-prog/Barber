/**
 * Сообщения бота отправляются с parse_mode = HTML. Всё, что пришло от пользователей
 * (имена, телефоны, комментарии, названия услуг из админки), обязательно экранируется.
 * Telegram требует экранировать только &, < и > (https://core.telegram.org/bots/api#html-style).
 */
const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

/** Экранирует текст для HTML parse_mode (кавычки — чтобы значение было безопасно и в атрибуте href). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, char => HTML_ESCAPES[char] ?? char)
}

/** Жирный текст с экранированием содержимого. */
export function bold(value: string): string {
  return `<b>${escapeHtml(value)}</b>`
}

/** Ссылка с экранированием и текста, и адреса. */
export function link(text: string, url: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`
}
