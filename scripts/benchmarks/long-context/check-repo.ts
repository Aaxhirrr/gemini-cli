/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import {
  executeCommand,
  loadBenchmarkDataset,
  parseCliFlags,
  provisionWorkspace,
  resolveArtifactRoot,
  resolveBenchmarkRoot,
  selectTasks,
  writeJsonFile,
} from './shared.js';

async function main() {
  const { options } = parseCliFlags(process.argv.slice(2));
  const benchmarkRoot = resolveBenchmarkRoot();
  const artifactRoot = resolveArtifactRoot();
  const dataset = await loadBenchmarkDataset(benchmarkRoot);

  const targetRepositoryId =
    (options['repo'] as string | undefined) ||
    process.env['LONG_CONTEXT_BENCHMARK_TARGET_REPO'];
  const checkAllRepositories =
    process.env['LONG_CONTEXT_BENCHMARK_CHECK_ALL'] === '1';
  const runMode = process.env['LONG_CONTEXT_BENCHMARK_MODE'];

  const taskScopedRepositories =
    !targetRepositoryId && !checkAllRepositories && runMode
      ? new Set(
          selectTasks(dataset, { mode: runMode }).map(
            (task) => task.repository.spec.repositoryId,
          ),
        )
      : undefined;

  const repositories = targetRepositoryId
    ? dataset.repositories.filter(
        (repository) => repository.spec.repositoryId === targetRepositoryId,
      )
    : taskScopedRepositories && taskScopedRepositories.size > 0
      ? dataset.repositories.filter((repository) =>
          taskScopedRepositories.has(repository.spec.repositoryId),
        )
      : dataset.repositories;

  if (repositories.length === 0) {
    throw new Error(
      `No repositories matched ${JSON.stringify(targetRepositoryId || 'all')}.`,
    );
  }

  const checks = [];

  for (const repository of repositories) {
    const provisioned = await provisionWorkspace(repository);
    try {
      const statusResult = await executeCommand('git status --porcelain=v1', {
        cwd: provisioned.workspaceDir,
      });
      const cleanGitStatus =
        statusResult.exitCode === 0 && statusResult.stdout.trim() === '';

      const taskChecks = await Promise.all(
        dataset.tasks
          .filter(
            (task) =>
              task.repository.spec.repositoryId ===
              repository.spec.repositoryId,
          )
          .map(async (task) => ({
            taskId: task.spec.taskId,
            promptExists: true,
            curatorNotesExists: true,
            validatorExists: !!task.validatorFile,
            fakeResponsesExists: !!task.fakeResponsesFile,
          })),
      );

      checks.push({
        repositoryId: repository.spec.repositoryId,
        workspaceDir: provisioned.workspaceDir,
        cleanGitStatus,
        taskChecks,
      });
    } finally {
      await provisioned.cleanup();
    }
  }

  const outputPath = `${artifactRoot}/repo-check.json`;
  await writeJsonFile(outputPath, { repositories: checks });
  process.stdout.write(
    `Checked ${checks.length} benchmark repositories. Summary artifact: ${outputPath}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
