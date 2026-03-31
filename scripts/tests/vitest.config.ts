/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';
import { OneLineVitestReporter } from '../test-output/oneLineVitestReporter.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/tests/**/*.test.{js,ts}'],
    setupFiles: ['scripts/tests/test-setup.ts'],
    reporters: [new OneLineVitestReporter()],
    silent: true,
    slowTestThreshold: 100000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
    poolOptions: {
      threads: {
        minThreads: 8,
        maxThreads: 16,
      },
    },
  },
});
