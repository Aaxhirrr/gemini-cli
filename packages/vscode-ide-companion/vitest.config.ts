/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';
import {
  OneLineVitestReporter,
  SilentJUnitReporter,
} from '../../scripts/test-output/oneLineVitestReporter.js';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    reporters: [
      new OneLineVitestReporter(),
      new SilentJUnitReporter({ outputFile: 'junit.xml' }),
    ],
    silent: true,
    slowTestThreshold: 100000,
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: [
        'html',
        'json',
        'lcov',
        'cobertura',
        ['json-summary', { outputFile: 'coverage-summary.json' }],
      ],
    },
  },
});
