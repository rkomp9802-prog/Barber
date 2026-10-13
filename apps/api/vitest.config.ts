import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Интеграционные тесты с реальной БД идут последовательно, чтобы не мешать друг другу.
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
