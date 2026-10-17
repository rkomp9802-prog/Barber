-- 0005: подтверждение номера через Telegram.
-- Запись с сайта создаётся со статусом pending и держит слот BOOKING_HOLD_MIN минут, пока клиент
-- не подтвердит номер в боте («Поделиться номером»). Одна транзакция: защита от двойной записи
-- ни на миг не пропадает.
BEGIN;

ALTER TABLE "bookings"
  ADD COLUMN "hold_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "claim_telegram_id" BIGINT,
  ADD COLUMN "hold_ip_hash" TEXT;

ALTER TABLE "clients" ADD COLUMN "phone_verified_at" TIMESTAMPTZ(6);

CREATE INDEX "bookings_status_hold_expires_at_idx" ON "bookings"("status", "hold_expires_at");
CREATE INDEX "bookings_claim_telegram_id_idx" ON "bookings"("claim_telegram_id");

-- Новый статус pending.
ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));

-- У pending обязательно есть срок удержания.
ALTER TABLE bookings ADD CONSTRAINT bookings_hold_check
  CHECK (status <> 'pending' OR hold_expires_at IS NOT NULL);

-- Неподтверждённая запись тоже занимает слот. Просроченные pending приложение удаляет
-- до вставки новой записи на это время и раз в 5 минут (функция notifications).
ALTER TABLE bookings DROP CONSTRAINT bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
  barber_id WITH =,
  time_range WITH &&
)
WHERE (status IN ('pending', 'confirmed'));

COMMIT;
