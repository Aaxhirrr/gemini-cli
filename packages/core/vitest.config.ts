/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';
import {
  OneLineVitestReporter,
  SilentJUnitReporter,
} from '../../scripts/test-output/oneLineVitestReporter.js';

export default defineConfig({
  test: {
    reporters: [
      new OneLineVitestReporter(),
      new SilentJUnitReporter({ outputFile: 'junit.xml' }),
    ],
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks',
    silent: true,
    slowTestThreshold: 100000,
    setupFiles: ['./test-setup.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*'],
      reporter: [
        ['text', { file: 'full-text-summary.txt' }],
        'html',
        'json',
        'lcov',
        'cobertura',
        ['json-summary', { outputFile: 'coverage-summary.json' }],
      ],
    },
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      },
    },
  },
});
