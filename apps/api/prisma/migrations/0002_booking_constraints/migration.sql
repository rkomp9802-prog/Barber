-- 0002_booking_constraints: то, что нельзя описать в schema.prisma.
-- 1) защита от двойной записи (spec §6), 2) CHECK-ограничения, 3) Row Level Security.

-- ---------- 1. Защита от двойной записи ----------
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
ADD COLUMN time_range tstzrange
GENERATED ALWAYS AS (
  tstzrange(starts_at, ends_at, '[)')
) STORED;

ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
  barber_id WITH =,
  time_range WITH &&
)
WHERE (status = 'confirmed');

-- ---------- 2. Проверки данных ----------
ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
  ADD CONSTRAINT bookings_source_check CHECK (source IN ('web', 'telegram', 'admin')),
  ADD CONSTRAINT bookings_time_check CHECK (ends_at > starts_at),
  ADD CONSTRAINT bookings_totals_check CHECK (total_price >= 0 AND total_duration_min > 0);

ALTER TABLE booking_services
  ADD CONSTRAINT booking_services_values_check CHECK (price >= 0 AND duration_min > 0);

ALTER TABLE services
  ADD CONSTRAINT services_values_check CHECK (price >= 0 AND duration_min > 0);

ALTER TABLE barber_services
  ADD CONSTRAINT barber_services_values_check CHECK (
    (price IS NULL OR price >= 0) AND (duration_min IS NULL OR duration_min > 0)
  );

ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE working_hours
  ADD CONSTRAINT working_hours_weekday_check CHECK (weekday BETWEEN 0 AND 6),
  ADD CONSTRAINT working_hours_format_check CHECK (
    start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND end_time ~ '^([01][0-9]|2[0-4]):[0-5][0-9]$'
  ),
  ADD CONSTRAINT working_hours_order_check CHECK (start_time < end_time);

ALTER TABLE breaks
  ADD CONSTRAINT breaks_weekday_check CHECK (weekday BETWEEN 0 AND 6),
  ADD CONSTRAINT breaks_format_check CHECK (
    start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND end_time ~ '^([01][0-9]|2[0-4]):[0-5][0-9]$'
  ),
  ADD CONSTRAINT breaks_order_check CHECK (start_time < end_time);

ALTER TABLE time_off
  ADD CONSTRAINT time_off_type_check CHECK (type IN ('day_off', 'vacation', 'sick', 'other', 'shop_closed')),
  ADD CONSTRAINT time_off_order_check CHECK (ends_at > starts_at);

-- ---------- 3. Индексы для расписания ----------
-- bookings(barber_id, starts_at) и bookings(status, starts_at) созданы в 0001_init.
-- Быстрый поиск пересечений с отпусками/закрытием салона.
CREATE INDEX time_off_range_idx ON time_off USING gist (tstzrange(starts_at, ends_at, '[)'));

-- ---------- 4. Row Level Security ----------
-- API подключается ролью postgres (обходит RLS). Публичных политик нет:
-- роли anon/authenticated (Supabase Data API) не видят и не меняют ничего.
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS _prisma_migrations ENABLE ROW LEVEL SECURITY;
