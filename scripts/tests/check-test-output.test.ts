/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  analyzeOutput,
  findThresholdViolations,
  parsePatternThresholds,
  runCheckTestOutput,
} from '../check-test-output.js';

describe('check-test-output', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('analyzes output and counts known noisy patterns', () => {
    const output = [
      'Ignore file not found: /tmp/.geminiignore',
      '[STARTUP] StartupProfiler.flush() called with 0 phases',
      'TEST: debug line',
      'MaxListenersExceededWarning: Possible EventEmitter memory leak detected',
      '[watch] build started',
    ].join('\n');

    expect(analyzeOutput(output)).toEqual({
      bytes: Buffer.byteLength(output, 'utf8'),
      lines: 5,
      countedLines: 5,
      patternCounts: {
        ignoreFileNotFound: 1,
        startupLogs: 1,
        rawTestWrites: 1,
        maxListenersWarnings: 1,
        watchBuildLogs: 1,
      },
    });
  });

  it('parses and validates pattern thresholds', () => {
    expect(parsePatternThresholds(['rawTestWrites=0'])).toEqual([
      { name: 'rawTestWrites', limit: 0 },
    ]);

    expect(() => parsePatternThresholds(['unknown=0'])).toThrow(
      'Unknown pattern "unknown".',
    );
  });

  it('reports threshold violations for excessive output', () => {
    const analysis = analyzeOutput(
      'TEST: debug line\nTEST: another debug line',
    );

    expect(
      findThresholdViolations(analysis, {
        maxLines: 1,
        maxBytes: undefined,
        maxPatterns: [{ name: 'rawTestWrites', limit: 0 }],
      }),
    ).toEqual([
      'counted line count 2 exceeds max-lines 1',
      'pattern "rawTestWrites" matched 2 times and exceeds limit 0',
    ]);
  });

  it('returns a failing exit code when input output violates configured limits', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'check-test-output-'),
    );
    const inputPath = path.join(tempDir, 'test-output.log');
    await fs.writeFile(inputPath, 'TEST: debug line\n', 'utf8');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const exitCode = await runCheckTestOutput([
      '--input',
      inputPath,
      '--max-pattern',
      'rawTestWrites=0',
    ]);

    expect(exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Threshold violations:');
  });
});
