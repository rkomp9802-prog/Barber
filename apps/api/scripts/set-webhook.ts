/**
 * Настраивает бота в Telegram: webhook (с secret_token), команды и кнопка меню Mini App.
 * Запуск: npm run telegram:set-webhook -w @barber/api (читает apps/api/.env).
 * Нужны TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, API_URL (https), MINIAPP_URL (необязательно).
 */
import { Api } from 'grammy'
import { loadConfig } from '../src/config'
import { loadLocalEnv } from '../src/runtime'
import { BOT_COMMANDS } from '../src/telegram/bot'

const WEBHOOK_PATH = '/telegram/webhook'
const MENU_BUTTON_TEXT = 'Записаться'
/** Только то, что бот обрабатывает: сообщения и нажатия inline-кнопок. */
const ALLOWED_UPDATES = ['message', 'callback_query'] as const

function requireHttps(name: string, value: string | undefined): string {
  if (!value?.startsWith('https://')) throw new Error(`${name} должен быть https-адресом`)
  return value
}

async function main(): Promise<void> {
  loadLocalEnv()
  const config = loadConfig()
  const token = config.telegram.botToken
  const secret = config.bot.webhookSecret
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан')
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET не задан (16–256 символов A-Z a-z 0-9 _ -)')
  const webhookUrl = `${requireHttps('API_URL', config.apiUrl).replace(/\/$/, '')}${WEBHOOK_PATH}`
  const api = new Api(token)

  await api.setWebhook(webhookUrl, { secret_token: secret, allowed_updates: [...ALLOWED_UPDATES] })
  await api.setMyCommands(BOT_COMMANDS.map(command => ({ command: command.command, description: command.description })))
  if (config.bot.miniAppUrl) {
    const miniAppUrl = requireHttps('MINIAPP_URL', config.bot.miniAppUrl)
    await api.setChatMenuButton({ menu_button: { type: 'web_app', text: MENU_BUTTON_TEXT, web_app: { url: miniAppUrl } } })
  }

  const info = await api.getWebhookInfo()
  process.stdout.write(`Webhook: ${info.url}\nОжидает обновлений: ${info.pending_update_count}\n`)
  if (info.last_error_message) process.stdout.write(`Последняя ошибка Telegram: ${info.last_error_message}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`Не удалось настроить бота: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
