import { defineConfig } from 'vitest/config'

// Тесты чистой логики Edge Functions запускаются в Node: `npm run test:functions` из корня репозитория.
// db.ts и index.ts зависят от Deno (Deno.serve, npm:-импорты) и здесь не импортируются.
export default defineConfig({
  test: {
    include: ['functions/**/*.test.ts'],
    environment: 'node',
  },
})
