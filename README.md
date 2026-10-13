# Sharp Barbershop — учебная система записи

Сайт барбершопа с онлайн-записью. Проект собирается по этапам из [`tasks-final.md`](tasks-final.md);
требования — в [`prd-final.md`](prd-final.md), техническая спецификация — в [`spec-final.md`](spec-final.md).

## Что уже готово

| Этап | Что сделано | Статус |
|---|---|---|
| 1. Сайт | Лендинг: шапка, hero, услуги и цены, барберы, отзывы, контакты и карта, светлая/тёмная тема | ✅ |
| 2. Интерфейс записи | `/book`: услуга → барбер → дата → время → контакты → подтверждение на тестовых данных | ✅ |
| 3. База данных | Supabase + Prisma | ⏳ нужен проект Supabase |
| 4–11 | Backend, настоящая запись, Mini App, бот, напоминания, админка, аналитика, деплой | ⏳ |

## Запуск

Нужен Node.js 22.12+.

```bash
npm install
npm run dev
```

Сайт откроется на http://localhost:3000, запись — на http://localhost:3000/book.

Демо-режимы страницы записи:

- `/book?service=haircut` — услуга уже выбрана;
- `/book?barber=timur` — барбер уже выбран;
- `/book?demo=error` — показать состояние ошибки при загрузке времени.

## Проверки

```bash
npm run test       # unit-тесты (Vitest)
npm run typecheck  # TypeScript
npm run build      # production-сборка сайта
```

## Структура

```text
apps/
  web/              Next.js: лендинг и /book (позже /booking/[token] и /admin)
    src/app/        страницы
    src/components/ landing/, booking/, ui/
    src/data/       тестовые данные этапов 1–2 (на этапе 4 их заменит API)
packages/
  shared/           общие типы, формат цен/дат/телефонов, расчёт итогов записи
```

Позже появятся `apps/api` (Fastify), `apps/miniapp` (React + Vite), `packages/ui` и `supabase/functions`.

## Время и деньги

- Все даты на сайте показываются по `Asia/Tashkent`.
- Цены — в сумах, целыми числами.
