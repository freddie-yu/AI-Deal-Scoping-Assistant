import { defineConfig } from 'vitest/config';
// Bound concurrent filesystem-heavy session suites so original 5s regressions
// do not time out under CPU/I/O contention as the suite grows.
export default defineConfig({ test: { maxWorkers: 4, include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'] } });
