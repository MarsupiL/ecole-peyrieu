import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/data/**/*.ts'],
      exclude: ['src/data/seed.ts', 'src/data/templates.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 75,
        lines: 80,
        'src/data/repository.ts': { lines: 90, branches: 80 },
        'src/domain/policy.ts': { lines: 80, branches: 75 },
      },
    },
  },
});
