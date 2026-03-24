/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import {
  loadBenchmarkDataset,
  parseCliFlags,
  resolveArtifactRoot,
  resolveBenchmarkRoot,
  resolveModelMatrix,
  runBenchmarkTask,
  selectTasks,
  writeJsonFile,
} from './shared.js';

async function main() {
  const { options } = parseCliFlags(process.argv.slice(2));
  const benchmarkRoot = resolveBenchmarkRoot();
  const artifactRoot = resolveArtifactRoot();
  const mode =
    (options['mode'] as string | undefined) ||
    process.env['LONG_CONTEXT_BENCHMARK_MODE'] ||
    'manual';
  const shardId =
    (options['shard'] as string | undefined) ||
    process.env['LONG_CONTEXT_BENCHMARK_SHARD'];
  const repositoryId =
    (options['repo'] as string | undefined) ||
    process.env['LONG_CONTEXT_BENCHMARK_TARGET_REPO'];
  const taskId =
    (options['task'] as string | undefined) ||
    process.env['LONG_CONTEXT_BENCHMARK_TASK_ID'];
  const taskLimit = Number(
    (options['task-limit'] as string | undefined) ||
      process.env['LONG_CONTEXT_BENCHMARK_TASK_LIMIT'] ||
      '',
  );
  const keepWorkspace =
    options['keep-workspace'] === true ||
    process.env['LONG_CONTEXT_BENCHMARK_KEEP_WORKSPACE'] === 'true';
  const useFakeResponses =
    process.env['LONG_CONTEXT_BENCHMARK_USE_FAKE_RESPONSES'] === 'true' ||
    mode === 'smoke';

  const dataset = await loadBenchmarkDataset(benchmarkRoot);
  const selectedTasks = selectTasks(dataset, {
    repositoryId,
    taskId,
    shardId,
    mode,
    taskLimit: Number.isFinite(taskLimit) ? taskLimit : undefined,
  });

  if (selectedTasks.length === 0) {
    throw new Error('No benchmark tasks matched the current selection.');
  }

  const models = resolveModelMatrix(dataset, mode);
  const runResults = [];

  for (const model of models) {
    for (const task of selectedTasks) {
      const execution = await runBenchmarkTask(task, {
        benchmarkId: dataset.manifest.benchmarkId,
        benchmarkVersion: dataset.manifest.benchmarkVersion,
        artifactRoot,
        runMode: mode,
        model,
        keepWorkspace,
        useFakeResponses,
      });
      runResults.push(execution.result);
    }
  }

  const summary = {
    benchmarkId: dataset.manifest.benchmarkId,
    runMode: mode,
    taskCount: selectedTasks.length,
    modelCount: models.length,
    resultCount: runResults.length,
    passed: runResults.filter((result) => result.status === 'passed').length,
    failed: runResults.filter((result) => result.status === 'failed').length,
    errored: runResults.filter((result) => result.status === 'errored').length,
    partial: runResults.filter((result) => result.status === 'partial').length,
    resultFiles: runResults.map((result) => result.artifacts.resultJson),
  };

  const outputPath = `${artifactRoot}/last-run-summary.json`;
  await writeJsonFile(outputPath, summary);

  process.stdout.write(
    [
      `Ran ${summary.resultCount} long-context benchmark executions.`,
      `Passed: ${summary.passed}`,
      `Failed: ${summary.failed}`,
      `Errored: ${summary.errored}`,
      `Partial: ${summary.partial}`,
      `Summary artifact: ${outputPath}`,
    ].join('\n') + '\n',
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
