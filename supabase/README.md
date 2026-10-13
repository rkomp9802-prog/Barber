# Supabase: автоматические напоминания (этап 8)

Здесь живёт Edge Function `notifications`. Supabase Cron вызывает её каждые 5 минут.
Долгоживущего worker-процесса нет: каждый вызов делает свою работу и завершается.

```
pg_cron (каждые 5 мин) ──net.http_post──▶ Edge Function notifications ──▶ PostgreSQL (bookings)
                                                     │
                                                     └──sendMessage──▶ Telegram Bot API
```

## Что делает один запуск

| Задача | Какие записи берёт | Что пишет в БД | Сообщение |
|---|---|---|---|
| Автозавершение | `status = confirmed` и `ends_at < now()` | `status = completed`, `auto_completed_at` | нет |
| Напоминание за день | `confirmed`, начало в ближайшие `reminder_day_minutes` (1440) минут | `reminder_day_sent_at` | «Напоминаем о записи…» |
| Напоминание за 30 минут | `confirmed`, начало в ближайшие `reminder_short_minutes` (30) минут | `reminder_30m_sent_at` | «Ваш визит через N минут» |
| Запрос отзыва | `completed`, с конца визита прошло `review_delay_min` (60) минут | `review_requested_at` | кнопки 1–5, `callback_data = rate:<bookingId>:<n>` |

Окна берутся из таблицы `settings`. Время в сообщениях показывается по `Asia/Tashkent`.

Когда сообщение не отправляется, а запись всё равно помечается обработанной:

- у клиента нет `telegram_chat_id` (записался на сайте и не открыл бота). Если не ставить отметку, функция находила бы эту запись каждые 5 минут;
- напоминание за день не нужно, если запись создана меньше чем за 2 часа до визита;
- напоминание за день не нужно, если до визита уже меньше 30 минут: сейчас уйдёт короткое напоминание;
- напоминание за 30 минут не нужно, если запись создана меньше чем за 30 минут до визита;
- отзыв не просим, если визит закончился больше 3 суток назад.

## Файлы

| Файл | Что внутри |
|---|---|
| `functions/notifications/index.ts` | HTTP-обработчик (`Deno.serve`): проверка секрета, запуск задач, JSON-лог |
| `functions/notifications/jobs.ts` | порядок задач и схема «захватить → отправить → при сбое вернуть» |
| `functions/notifications/logic.ts` | чистая логика: тексты, форматирование времени, решения, классификация ошибок |
| `functions/notifications/telegram.ts` | `sendMessage` через `fetch` |
| `functions/notifications/db.ts` | SQL-запросы (postgres.js) |
| `functions/notifications/*.test.ts` | тесты Vitest (запускаются в Node) |
| `migrations/*_notifications_cron.sql` | pg_cron, pg_net, Vault и расписание |
| `config.toml` | `verify_jwt = false` для функции |

## Как работает идемпотентность

Задача: если cron сработает дважды или два запуска наложатся, клиент всё равно должен получить одно сообщение, а не два.

1. **Сначала ставим отметку, потом отправляем (claim → send).** Одним SQL-оператором:

   ```sql
   WITH due AS (
     SELECT b.id FROM bookings b
     WHERE b.reminder_day_sent_at IS NULL AND <условие окна>
     LIMIT 50
     FOR UPDATE OF b SKIP LOCKED      -- строки, занятые другим запуском, пропускаем
   )
   UPDATE bookings b SET reminder_day_sent_at = now()
   FROM due
   WHERE b.id = due.id AND b.reminder_day_sent_at IS NULL   -- повторная проверка
   RETURNING ...;
   ```

   После этого оператора отметка уже стоит. Следующий запуск увидит `IS NOT NULL` и эту запись не возьмёт. Два одновременных запуска не возьмут одну строку: `FOR UPDATE SKIP LOCKED` отдаёт каждую строку только одному из них.

2. **Если Telegram не принял сообщение**, решаем по коду ответа (`classifyTelegramFailure` в `logic.ts`):
   - сеть упала, таймаут, `429` или `5xx`: проблема временная. Снимаем отметку (`SET ... = NULL`), и через 5 минут будет новая попытка;
   - другие `4xx` (`403` бот заблокирован, `400` чат не найден): повтор вернёт ту же ошибку. Отметку оставляем, сообщение не повторяем.

3. **Что выбрано осознанно.** Если функция упадёт между отметкой и отправкой, сообщение потеряется. Обратный порядок (сначала отправить, потом отметить) при падении дал бы дубль. Для напоминаний пропуск безопаснее спама. Редкий дубль возможен только в одном случае: Telegram получил сообщение, а ответ до нас не дошёл (сетевая ошибка).

4. **Автозавершение** идемпотентно само по себе: `UPDATE ... WHERE status = 'confirmed'`. Второй раз эта запись под условие уже не попадёт.

> Для API (перенос записи): при изменении `starts_at` нужно сбросить `reminder_day_sent_at` и `reminder_30m_sent_at` в `NULL`, иначе по новому времени напоминания не придут.

## Деплой

Нужен [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# 1. Вход и привязка к проекту (Reference ID: Project Settings → General)
supabase login
supabase link --project-ref <PROJECT_REF>

# 2. Секреты функции (SUPABASE_DB_URL Supabase передаёт сам)
#    CRON_SECRET: длинная случайная строка, минимум 16 символов, например `openssl rand -hex 32`
supabase secrets set TELEGRAM_BOT_TOKEN=<токен от @BotFather> CRON_SECRET=<ваш секрет>

# 3. Деплой функции (verify_jwt = false берётся из config.toml)
supabase functions deploy notifications --no-verify-jwt
```

### Включить cron

1. Откройте Supabase Dashboard → SQL Editor и создайте секреты Vault. Подставьте значения и **не сохраняйте их в git**:

   ```sql
   select vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/notifications', 'notifications_function_url');
   select vault.create_secret('<CRON_SECRET>', 'notifications_cron_secret');
   ```

   Чтобы поменять секрет позже:
   `select vault.update_secret((select id from vault.secrets where name = 'notifications_cron_secret'), '<новый>');`

2. Выполните миграцию `migrations/20261011120000_notifications_cron.sql`: целиком вставьте её в SQL Editor или запустите `supabase db push`. Если плейсхолдеры в файле не заменены, она пропустит шаг с Vault и только включит расширения и расписание.

3. Проверьте:

   ```sql
   select * from cron.job where jobname = 'notifications-every-5-min';
   select * from cron.job_run_details order by start_time desc limit 5;
   select status_code, content from net._http_response order by created desc limit 5;
   ```

## Ручная проверка через curl

```bash
# Без секрета: 401
curl -i -X POST https://<PROJECT_REF>.supabase.co/functions/v1/notifications

# С секретом: 200 и сводка
curl -i -X POST https://<PROJECT_REF>.supabase.co/functions/v1/notifications \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" -d '{}'
```

Пример ответа:

```json
{"ok":true,"autoCompleted":1,
 "day":{"claimed":2,"sent":1,"skipped":1,"retryLater":0,"dropped":0},
 "short":{"claimed":0,"sent":0,"skipped":0,"retryLater":0,"dropped":0},
 "review":{"claimed":1,"sent":1,"skipped":0,"retryLater":0,"dropped":0},
 "failedJobs":[]}
```

**Проверка идемпотентности.** Создайте запись, до которой меньше 24 часов (и которая создана больше чем за 2 часа до начала, или поправьте `created_at` вручную). Вызовите curl два раза подряд. В первом ответе будет `"day":{"claimed":1,"sent":1,...}`, во втором `"claimed":0`. В Telegram придёт одно сообщение.

Логи функции: Dashboard → Edge Functions → notifications → Logs. На каждый запуск пишется строка `notifications_run` со счётчиками. Телефонов, chat_id и токенов в логах нет.

## Тесты

Из корня репозитория:

```bash
npm run test:functions
```

Тесты используют только `logic.ts`, `jobs.ts` и `telegram.ts`: в них нет Deno-API, поэтому они работают в Node. Базу и Telegram в тестах заменяют заглушки. `db.ts` и `index.ts` можно проверить командой `deno check functions/notifications/index.ts`, если Deno установлен.
