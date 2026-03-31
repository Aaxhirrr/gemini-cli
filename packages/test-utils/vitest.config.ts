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
    silent: true,
    slowTestThreshold: 100000,
    poolOptions: {
      threads: {
        minThreads: 8,
        maxThreads: 16,
      },
    },
  },
});
