/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import process from 'node:process';
import {
  loadBenchmarkDataset,
  resolveArtifactRoot,
  resolveBenchmarkRoot,
  writeJsonFile,
} from './shared.js';

function incrementCount(target: Record<string, number>, key: string) {
  target[key] = (target[key] || 0) + 1;
}

function renderMarkdown(summary: {
  benchmarkId: string;
  benchmarkVersion: string;
  totalRepositories: number;
  repositoriesWithTasks: number;
  metadataOnlyRepositories: number;
  languages: Record<string, number>;
  frameworks: Record<string, number>;
  repositories: Array<{
    repositoryId: string;
    title: string;
    sourceUrl: string;
    defaultBranch: string;
    pinnedCommit: string;
    license: string;
    languages: string[];
    frameworks: string[];
    taskCount: number;
    status: 'runnable' | 'intake-only';
  }>;
}) {
  const lines = [
    '# Long-Context Intake Summary',
    '',
    `- Benchmark: ${summary.benchmarkId}@${summary.benchmarkVersion}`,
    `- Total repositories: ${summary.totalRepositories}`,
    `- Repositories with runnable tasks: ${summary.repositoriesWithTasks}`,
    `- Intake-only repositories: ${summary.metadataOnlyRepositories}`,
    '',
    '## Language Coverage',
    ...Object.entries(summary.languages).map(
      ([language, count]) => `- ${language}: ${count}`,
    ),
    '',
    '## Framework Coverage',
    ...Object.entries(summary.frameworks).map(
      ([framework, count]) => `- ${framework}: ${count}`,
    ),
    '',
    '## Repository Intake',
  ];

  for (const repository of summary.repositories) {
    lines.push(
      `- ${repository.repositoryId}: ${repository.title} (${repository.status})`,
      `  source: ${repository.sourceUrl}`,
      `  branch: ${repository.defaultBranch}`,
      `  pinned commit: ${repository.pinnedCommit}`,
      `  license: ${repository.license}`,
      `  languages: ${repository.languages.join(', ')}`,
      `  frameworks: ${repository.frameworks.join(', ') || 'none recorded'}`,
      `  runnable tasks: ${repository.taskCount}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

async function main() {
  const benchmarkRoot = resolveBenchmarkRoot();
  const artifactRoot = resolveArtifactRoot();
  const dataset = await loadBenchmarkDataset(benchmarkRoot);

  const languages: Record<string, number> = {};
  const frameworks: Record<string, number> = {};

  const repositories = dataset.repositories
    .map((repository) => {
      for (const language of repository.spec.languages) {
        incrementCount(languages, language);
      }
      for (const framework of repository.spec.frameworks || []) {
        incrementCount(frameworks, framework);
      }

      const taskCount = dataset.tasks.filter(
        (task) =>
          task.repository.spec.repositoryId === repository.spec.repositoryId,
      ).length;

      return {
        repositoryId: repository.spec.repositoryId,
        title: repository.spec.title,
        sourceUrl: repository.spec.source.url || 'unknown',
        defaultBranch: repository.spec.defaultBranch || 'main',
        pinnedCommit: repository.spec.source.pinnedCommit || 'unversioned',
        license: repository.spec.source.license || 'unspecified',
        languages: repository.spec.languages,
        frameworks: repository.spec.frameworks || [],
        taskCount,
        status: taskCount > 0 ? ('runnable' as const) : ('intake-only' as const),
      };
    })
    .sort((left, right) => left.repositoryId.localeCompare(right.repositoryId));

  const summary = {
    benchmarkId: dataset.manifest.benchmarkId,
    benchmarkVersion: dataset.manifest.benchmarkVersion,
    totalRepositories: repositories.length,
    repositoriesWithTasks: repositories.filter(
      (repository) => repository.taskCount > 0,
    ).length,
    metadataOnlyRepositories: repositories.filter(
      (repository) => repository.taskCount === 0,
    ).length,
    languages,
    frameworks,
    repositories,
  };

  const outputJson = `${artifactRoot}/intake-summary.json`;
  const outputMarkdown = `${artifactRoot}/intake-summary.md`;
  await writeJsonFile(outputJson, summary);
  await fs.writeFile(outputMarkdown, `${renderMarkdown(summary)}\n`, 'utf8');

  process.stdout.write(
    `Wrote long-context intake summary to ${outputJson} and ${outputMarkdown}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
