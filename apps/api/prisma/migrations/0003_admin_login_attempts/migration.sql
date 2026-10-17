-- Счётчик неудачных входов в админку: общий для всех инстансов API на Vercel.
CREATE TABLE "admin_login_attempts" (
    "login" TEXT NOT NULL,
    "failures" INTEGER NOT NULL,
    "last_failure_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_login_attempts_pkey" PRIMARY KEY ("login")
);

-- Как и остальные таблицы: через публичный REST Supabase (anon/authenticated) не читается.
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;
