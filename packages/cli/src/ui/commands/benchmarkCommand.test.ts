/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { benchmarkCommand } from './benchmarkCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { CommandContext } from './types.js';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function createBenchmarkFixture(rootDir: string) {
  await writeJson(path.join(rootDir, 'benchmarks/long-context/manifest.json'), {
    benchmarkId: 'long-context.seed.local',
    benchmarkVersion: '0.2.0',
    repositories: [
      {
        repositoryId: 'nextjs',
        repositoryFile: './repos/nextjs/repository.json',
      },
    ],
  });

  await writeJson(
    path.join(rootDir, 'benchmarks/long-context/repos/nextjs/repository.json'),
    {
      repositoryId: 'nextjs',
      title: 'vercel/next.js',
      defaultBranch: 'canary',
      languages: ['typescript', 'javascript', 'rust'],
      frameworks: ['next.js', 'react'],
      source: {
        url: 'https://github.com/vercel/next.js.git',
        pinnedCommit: 'aa3ba7ed15db36f1d21c827dd695a4e24a8955c6',
      },
      tasks: [{ taskId: 'next-dev-config-map' }],
    },
  );

  await writeJson(
    path.join(rootDir, 'artifacts/long-context-benchmark/dataset-validation.json'),
    {
      benchmarkId: 'long-context.seed.local',
      benchmarkVersion: '0.2.0',
      repositoryCount: 1,
      taskCount: 1,
      warnings: ['Dataset currently contains 1 repositories; rubric minimum is 30.'],
    },
  );

  await writeJson(
    path.join(rootDir, 'artifacts/long-context-benchmark/aggregate-summary.json'),
    {
      totalRuns: 10,
      passed: 10,
      failed: 0,
      errored: 0,
      partial: 0,
      byRepository: { nextjs: 10 },
      byDifficulty: { medium: 10 },
      byFailureCategory: { none: 10 },
      byLanguage: { typescript: 10, javascript: 10, rust: 10 },
      byModel: { 'deterministic-fake': 10 },
    },
  );

  await writeJson(
    path.join(rootDir, 'artifacts/long-context-benchmark/last-run-summary.json'),
    {
      runMode: 'manual',
    },
  );
}

describe('benchmarkCommand', () => {
  let tempRoot: string;
  let mockContext: CommandContext;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-command-'));
    await createBenchmarkFixture(tempRoot);

    mockContext = createMockCommandContext({
      services: {
        config: {
          getProjectRoot: vi.fn().mockReturnValue(tempRoot),
        },
      },
    } as unknown as CommandContext);

    spawnMock.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('renders the benchmark dashboard for the current workspace', async () => {
    if (!benchmarkCommand.action) {
      throw new Error('The benchmark command must have an action.');
    }

    await benchmarkCommand.action(mockContext, '');

    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'benchmark_dashboard',
        repositoryCount: 1,
        taskCount: 1,
        latestRun: expect.objectContaining({
          totalRuns: 10,
          passed: 10,
        }),
      }),
    );
  });

  it('runs the real repo lane and then renders the dashboard', async () => {
    const runCommand = benchmarkCommand.subCommands?.find(
      (command) => command.name === 'run',
    );
    const realCommand = runCommand?.subCommands?.find(
      (command) => command.name === 'real',
    );

    if (!realCommand?.action) {
      throw new Error('The benchmark real subcommand must have an action.');
    }

    spawnMock.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(() => child.emit('close', 0));
      return child;
    });

    await realCommand.action(mockContext, '');

    expect(mockContext.ui.setPendingItem).toHaveBeenNthCalledWith(1, {
      type: 'info',
      text: 'Running real-repo analysis benchmark lane...',
    });
    expect(spawnMock).toHaveBeenCalled();
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'benchmark_dashboard',
        latestRun: expect.objectContaining({
          label: 'real-repo analysis',
          totalRuns: 10,
        }),
      }),
    );
    expect(mockContext.ui.setPendingItem).toHaveBeenLastCalledWith(null);
  });
});
