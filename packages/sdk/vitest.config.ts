/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';
import { OneLineVitestReporter } from '../../scripts/test-output/oneLineVitestReporter.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test-setup.ts'],
    reporters: [new OneLineVitestReporter()],
    silent: true,
    slowTestThreshold: 100000,
  },
});
