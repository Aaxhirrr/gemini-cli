/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, beforeEach, afterEach, type TestContext } from 'vitest';
import { setMaxListeners } from 'node:events';
import { format } from 'node:util';
import { coreEvents, uiTelemetryService } from '@google/gemini-cli-core';
import { themeManager } from './src/ui/themes/theme-manager.js';

// Unset CI environment variable so that ink renders dynamically as it does in a real terminal
if (process.env.CI !== undefined) {
  delete process.env.CI;
}

process.env.VITEST = 'true';

global.IS_REACT_ACT_ENVIRONMENT = true;

// Raise listener ceilings for long-running UI suites without muting other warnings.
setMaxListeners(200);
coreEvents.setMaxListeners(200);
uiTelemetryService.setMaxListeners(200);

// Unset NO_COLOR environment variable to ensure consistent theme behavior between local and CI test runs
if (process.env.NO_COLOR !== undefined) {
  delete process.env.NO_COLOR;
}

// Force true color output for ink so that snapshots always include color information.
process.env.FORCE_COLOR = '3';

import './src/test-utils/customMatchers.js';

let consoleErrorSpy: vi.SpyInstance;
let actWarnings: Array<{ message: string; stack: string }> = [];
let bufferedTerminalOutput: { stdout: string[]; stderr: string[] } = {
  stdout: [],
  stderr: [],
};
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const originalEmitConsoleLog = coreEvents.emitConsoleLog;

const stringifyWriteChunk = (
  chunk: Parameters<typeof process.stdout.write>[0],
  encoding?: BufferEncoding,
) => {
  if (Buffer.isBuffer(chunk)) {
    return chunk.toString(encoding);
  }

  return String(chunk);
};

const captureTerminalWrite = (
  target: 'stdout' | 'stderr',
  args: Parameters<typeof process.stdout.write>,
) => {
  const [chunk, encodingOrCallback, maybeCallback] = args;
  const encoding =
    typeof encodingOrCallback === 'string' ? encodingOrCallback : undefined;
  const callback =
    typeof encodingOrCallback === 'function'
      ? encodingOrCallback
      : typeof maybeCallback === 'function'
        ? maybeCallback
        : undefined;

  bufferedTerminalOutput[target].push(stringifyWriteChunk(chunk, encoding));
  callback?.();

  return true;
};

const flushCapturedTerminalOutput = (
  context: TestContext,
  output: typeof bufferedTerminalOutput,
) => {
  const hasOutput = output.stdout.length > 0 || output.stderr.length > 0;
  if (!hasOutput || context.task.result?.state !== 'fail') {
    return;
  }

  if (output.stdout.length > 0) {
    originalStdoutWrite(
      `\n[vitest captured stdout] ${context.task.name}\n${output.stdout.join('')}`,
    );
  }

  if (output.stderr.length > 0) {
    originalStderrWrite(
      `\n[vitest captured stderr] ${context.task.name}\n${output.stderr.join('')}`,
    );
  }
};

beforeEach(() => {
  // Reset themeManager state to ensure test isolation
  themeManager.resetForTesting();

  actWarnings = [];
  bufferedTerminalOutput = { stdout: [], stderr: [] };
  process.stdout.write = ((...args) =>
    captureTerminalWrite(
      'stdout',
      args as Parameters<typeof process.stdout.write>,
    )) as typeof process.stdout.write;
  process.stderr.write = ((...args) =>
    captureTerminalWrite(
      'stderr',
      args as Parameters<typeof process.stderr.write>,
    )) as typeof process.stderr.write;
  coreEvents.emitConsoleLog = (() => {}) as typeof coreEvents.emitConsoleLog;
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    const firstArg = args[0];
    if (
      typeof firstArg === 'string' &&
      firstArg.includes('was not wrapped in act(...)')
    ) {
      const stackLines = (new Error().stack || '').split('\n');
      let lastReactFrameIndex = -1;

      // Find the index of the last frame that comes from react-reconciler
      for (let i = 0; i < stackLines.length; i++) {
        if (stackLines[i].includes('react-reconciler')) {
          lastReactFrameIndex = i;
        }
      }

      // If we found react-reconciler frames, start the stack trace after the last one.
      // Otherwise, just strip the first line (which is the Error message itself).
      const relevantStack =
        lastReactFrameIndex !== -1
          ? stackLines.slice(lastReactFrameIndex + 1).join('\n')
          : stackLines.slice(1).join('\n');

      if (relevantStack.includes('OverflowContext.tsx')) {
        return;
      }

      actWarnings.push({
        message: format(...args),
        stack: relevantStack,
      });
    }
  });
});

afterEach((context) => {
  consoleErrorSpy.mockRestore();
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
  coreEvents.emitConsoleLog = originalEmitConsoleLog;

  vi.unstubAllEnvs();

  flushCapturedTerminalOutput(context, bufferedTerminalOutput);

  if (actWarnings.length > 0) {
    const messages = actWarnings
      .map(({ message, stack }) => `${message}\n${stack}`)
      .join('\n\n');
    throw new Error(`Failing test due to "act(...)" warnings:\n${messages}`);
  }
});
