/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import {
  evaluateRubricWarnings,
  loadBenchmarkDataset,
  printUsage,
  resolveArtifactRoot,
  resolveBenchmarkRoot,
  writeJsonFile,
} from './shared.js';

async function main() {
  if (process.argv.includes('--help')) {
    printUsage(
      [
        'Validates benchmark manifest, repository specs, task specs, and path references.',
      ],
      { command: 'tsx ./scripts/benchmarks/long-context/validate-dataset.ts' },
    );
    return;
  }

  const benchmarkRoot = resolveBenchmarkRoot();
  const artifactRoot = resolveArtifactRoot();

  const dataset = await loadBenchmarkDataset(benchmarkRoot);
  const warnings = evaluateRubricWarnings(dataset);

  const summary = {
    benchmarkId: dataset.manifest.benchmarkId,
    benchmarkVersion: dataset.manifest.benchmarkVersion,
    repositoryCount: dataset.repositories.length,
    taskCount: dataset.tasks.length,
    repositories: dataset.repositories.map((repository) => ({
      repositoryId: repository.spec.repositoryId,
      languages: repository.spec.languages,
      taskCount: dataset.tasks.filter(
        (task) =>
          task.repository.spec.repositoryId === repository.spec.repositoryId,
      ).length,
    })),
    warnings,
  };

  const outputPath = `${artifactRoot}/dataset-validation.json`;
  await writeJsonFile(outputPath, summary);

  process.stdout.write(
    [
      `Validated long-context dataset at ${benchmarkRoot}.`,
      `Repositories: ${summary.repositoryCount}`,
      `Tasks: ${summary.taskCount}`,
      warnings.length > 0 ? `Warnings: ${warnings.length}` : 'Warnings: 0',
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
