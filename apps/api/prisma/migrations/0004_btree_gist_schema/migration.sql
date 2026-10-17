-- btree_gist лежал в public: его ~190 служебных функций были видны через публичный REST Supabase (роль anon).
-- Переносим в отдельную схему extensions. Exclusion constraint на bookings ссылается на операторы по OID,
-- поэтому защита от двойной записи продолжает работать без изменений.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
