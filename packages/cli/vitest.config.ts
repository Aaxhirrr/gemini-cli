/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import {
  OneLineVitestReporter,
  SilentJUnitReporter,
} from '../../scripts/test-output/oneLineVitestReporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    conditions: ['test'],
  },
  test: {
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}', 'config.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**'],
    environment: 'node',
    globals: true,
    reporters: [
      new OneLineVitestReporter(),
      new SilentJUnitReporter({ outputFile: 'junit.xml' }),
    ],
    silent: true,
    slowTestThreshold: 100000,
    alias: {
      react: path.resolve(__dirname, '../../node_modules/react'),
    },
    setupFiles: ['./test-setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks',
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
    server: {
      deps: {
        inline: [/@google\/gemini-cli-core/],
      },
    },
  },
});
