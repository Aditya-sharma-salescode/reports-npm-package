import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Test runner config for @aditya-sharma-salescode/reports-ui.
// jsdom environment + a setup file that wires jest-dom matchers and the MSW
// mock server. Coverage uses istanbul (v8 instrumentation interferes with the
// MSW + real-timer fetch round-trips this suite relies on).
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    // Run files sequentially — component + service tests share the MSW server
    // and real timers; a single fork keeps them deterministic.
    fileParallelism: false,
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    reporters: ['default', 'json'],
    outputFile: { json: './test-results/vitest-results.json' },
    coverage: {
      provider: 'istanbul',
      reportsDirectory: './coverage',
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      include: [
        'src/types/mdmReportsUtils.ts',
        'src/config/**/*.ts',
        'src/utils/hierarchyHelpers.ts',
        'src/services/**/*.ts',
        'src/screens/ReportTiles.tsx',
        'src/components/CompactCheckboxDropdown.tsx',
      ],
      exclude: ['**/*.d.ts'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
