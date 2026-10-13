-- =====================================================================
-- Этап 8. Supabase Cron вызывает Edge Function «notifications» каждые 5 минут.
--
-- Что делает миграция:
--   1. Включает расширения pg_cron (планировщик) и pg_net (HTTP-запросы из Postgres).
--   2. Кладёт в Supabase Vault два секрета: URL функции и CRON_SECRET
--      (только если вы заменили плейсхолдеры, см. ниже).
--   3. Регистрирует задачу cron «notifications-every-5-min».
--
-- Секреты читаются из Vault в момент каждого запуска, поэтому в таблице cron.job
-- и в логах они не видны, а поменять секрет можно без пересоздания задачи.
--
-- ВАЖНО про плейсхолдеры:
--   <PROJECT_REF>   — id проекта Supabase (Project Settings → General → Reference ID);
--   <CRON_SECRET>   — то же значение, что вы задали командой
--                     `supabase secrets set CRON_SECRET=...` (минимум 16 символов).
-- Не коммитьте файл с настоящим секретом! Рекомендуемый путь — оставить плейсхолдеры здесь,
-- а секреты создать вручную в SQL Editor (готовый запрос — в supabase/README.md).
-- Если плейсхолдеры не заменены, шаг 2 просто пропускается с NOTICE.
-- Миграцию можно запускать повторно: каждый шаг идемпотентен.
-- =====================================================================

-- 1. Расширения ---------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 2. Секреты в Vault ----------------------------------------------------
do $do$
declare
  function_url constant text := 'https://<PROJECT_REF>.supabase.co/functions/v1/notifications';
  cron_secret  constant text := '<CRON_SECRET>';
begin
  if function_url like '%<PROJECT_REF>%' or cron_secret = '<CRON_SECRET>' then
    raise notice 'notifications: плейсхолдеры не заменены, создайте секреты Vault вручную (см. supabase/README.md)';
    return;
  end if;

  if not exists (select 1 from vault.secrets where name = 'notifications_function_url') then
    perform vault.create_secret(function_url, 'notifications_function_url', 'URL Edge Function notifications');
  end if;

  if not exists (select 1 from vault.secrets where name = 'notifications_cron_secret') then
    perform vault.create_secret(cron_secret, 'notifications_cron_secret', 'Bearer-секрет для вызова notifications');
  end if;
end
$do$;

-- 3. Расписание ---------------------------------------------------------
-- cron.schedule с тем же именем заменяет существующую задачу, поэтому повторный запуск безопасен.
-- Даже если два запуска наложатся (медленный Telegram), функция не отправит дубли:
-- каждая запись захватывается атомарно (UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING).
select cron.schedule(
  'notifications-every-5-min',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'notifications_function_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notifications_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $cron$
);

-- Полезные запросы для проверки (выполнять вручную):
--   select * from cron.job where jobname = 'notifications-every-5-min';
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select id, status_code, content from net._http_response order by created desc limit 10;
-- Отключить расписание:
--   select cron.unschedule('notifications-every-5-min');
