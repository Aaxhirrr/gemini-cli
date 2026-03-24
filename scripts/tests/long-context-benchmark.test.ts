/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CLI_ENTRYPOINT,
  evaluateRubricWarnings,
  findRunResultFiles,
  loadBenchmarkDataset,
  pathExists,
  runBenchmarkTask,
  selectTasks,
} from '../benchmarks/long-context/shared.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((tempRoot) =>
      fs.rm(tempRoot, { recursive: true, force: true }),
    ),
  );
  tempRoots.length = 0;
});

describe('long-context benchmark scripts', () => {
  it('loads the intake dataset and surfaces remaining rubric warnings', async () => {
    const dataset = await loadBenchmarkDataset();
    const warnings = evaluateRubricWarnings(dataset);
    const smokeTasks = selectTasks(dataset, { mode: 'smoke' });

    expect(dataset.repositories).toHaveLength(11);
    expect(dataset.tasks).toHaveLength(1);
    expect(smokeTasks).toHaveLength(1);
    expect(warnings.some((warning) => warning.includes('minimum is 30'))).toBe(
      true,
    );
    expect(
      warnings.some((warning) =>
        warning.includes('missing rubric language families'),
      ),
    ).toBe(false);
  });

  it('runs the smoke task with fake responses and records a passing result', async () => {
    if (!(await pathExists(CLI_ENTRYPOINT))) {
      return;
    }

    const dataset = await loadBenchmarkDataset();
    const [task] = selectTasks(dataset, { mode: 'smoke' });
    const artifactRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'long-context-benchmark-artifacts-'),
    );
    tempRoots.push(artifactRoot);

    const execution = await runBenchmarkTask(task, {
      benchmarkId: dataset.manifest.benchmarkId,
      benchmarkVersion: dataset.manifest.benchmarkVersion,
      artifactRoot,
      runMode: 'smoke',
      model: 'deterministic-fake',
      useFakeResponses: true,
    });

    expect(execution.result.status).toBe('passed');
    expect(execution.result.filesModified).toContain(
      'packages/config/defaults.json',
    );
    expect(execution.result.validation.validatorResult?.status).toBe('passed');

    const resultFiles = await findRunResultFiles(
      path.join(artifactRoot, 'runs'),
    );
    expect(resultFiles).toHaveLength(1);
  }, 30_000);
});
