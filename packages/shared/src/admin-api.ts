/**
 * Контракт админского API /api/v1/admin/* (spec-final.md §8, §10, §14; этапы 9–10).
 * Используют apps/api (валидация) и админка apps/web/admin (типы ответов).
 *
 * Общие правила:
 * - Авторизация — httpOnly cookie ADMIN_SESSION_COOKIE (ставит POST /admin/login).
 *   Запросы из браузера: fetch(..., { credentials: 'include' }).
 * - Все изменяющие запросы (POST/PUT/PATCH/DELETE, включая login/logout) обязаны
 *   передавать заголовок ADMIN_CSRF_HEADER: ADMIN_CSRF_VALUE, иначе 403 FORBIDDEN.
 * - Без сессии — 401 UNAUTHORIZED.
 * - Абсолютные моменты — ISO 8601 UTC; даты дня — 'YYYY-MM-DD' по Asia/Tashkent;
 *   время графика — 'HH:MM' по Ташкенту. Деньги — целые сумы.
 */

export * from './admin-api/common'
export * from './admin-api/catalog'
export * from './admin-api/operations'
// analytics (этап 10) сюда не входит: подключается отдельно, когда будет готова аналитика.
