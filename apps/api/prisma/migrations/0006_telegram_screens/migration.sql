-- Последнее сообщение-меню бота в каждом чате: новое меню удаляет прежнее (чат без мусора).
CREATE TABLE "telegram_screens" (
    "chat_id" BIGINT NOT NULL,
    "message_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_screens_pkey" PRIMARY KEY ("chat_id")
);

-- Как и остальные таблицы: через публичный REST Supabase (anon/authenticated) не читается.
ALTER TABLE telegram_screens ENABLE ROW LEVEL SECURITY;
