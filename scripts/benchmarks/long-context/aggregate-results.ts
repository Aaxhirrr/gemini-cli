/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import process from 'node:process';
import {
  type BenchmarkRunResult,
  findRunResultFiles,
  readJsonFile,
  resolveArtifactRoot,
  writeJsonFile,
} from './shared.js';

function ratio(part: number, whole: number) {
  if (whole === 0) {
    return 0;
  }
  return Number(((part / whole) * 100).toFixed(2));
}

function incrementCount<T extends string>(target: Record<T, number>, key: T) {
  target[key] = (target[key] || 0) + 1;
}

function renderMarkdown(summary: {
  totalRuns: number;
  passed: number;
  failed: number;
  errored: number;
  partial: number;
  byRepository: Record<string, number>;
  byDifficulty: Record<string, number>;
  byFailureCategory: Record<string, number>;
  byLanguage: Record<string, number>;
  byModel: Record<string, number>;
}) {
  const lines = [
    '# Long-Context Benchmark Summary',
    '',
    `- Total runs: ${summary.totalRuns}`,
    `- Pass rate: ${ratio(summary.passed, summary.totalRuns)}%`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Errored: ${summary.errored}`,
    `- Partial: ${summary.partial}`,
    '',
    '## By Repository',
    ...Object.entries(summary.byRepository).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    '',
    '## By Difficulty',
    ...Object.entries(summary.byDifficulty).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    '',
    '## By Failure Category',
    ...Object.entries(summary.byFailureCategory).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    '',
    '## By Language',
    ...Object.entries(summary.byLanguage).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    '',
    '## By Model',
    ...Object.entries(summary.byModel).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    '',
  ];

  return lines.join('\n');
}

async function main() {
  const artifactRoot = resolveArtifactRoot();
  const latestOnly = process.env['LONG_CONTEXT_BENCHMARK_LATEST_ONLY'] === '1';
  const lastRunSummaryPath = `${artifactRoot}/last-run-summary.json`;
  const resultFiles = latestOnly
    ? await readJsonFile<{
        resultFiles?: string[];
      }>(lastRunSummaryPath)
        .then((summary) => summary.resultFiles || [])
        .catch(() => [])
    : await findRunResultFiles(`${artifactRoot}/runs`);
  const results = await Promise.all(
    resultFiles.map((filePath) => readJsonFile<BenchmarkRunResult>(filePath)),
  );

  const summary = {
    totalRuns: results.length,
    passed: results.filter((result) => result.status === 'passed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    errored: results.filter((result) => result.status === 'errored').length,
    partial: results.filter((result) => result.status === 'partial').length,
    byRepository: {} as Record<string, number>,
    byDifficulty: {} as Record<string, number>,
    byFailureCategory: {} as Record<string, number>,
    byLanguage: {} as Record<string, number>,
    byModel: {} as Record<string, number>,
  };

  for (const result of results) {
    incrementCount(summary.byRepository, result.repositoryId);
    incrementCount(summary.byDifficulty, result.taskDifficulty);
    incrementCount(summary.byModel, result.model);
    incrementCount(summary.byFailureCategory, result.failureCategory || 'none');
    for (const language of result.repositoryLanguages) {
      incrementCount(summary.byLanguage, language);
    }
  }

  const outputJson = `${artifactRoot}/aggregate-summary.json`;
  const outputMarkdown = `${artifactRoot}/aggregate-summary.md`;
  await writeJsonFile(outputJson, summary);
  await fs.writeFile(outputMarkdown, `${renderMarkdown(summary)}\n`, 'utf8');

  process.stdout.write(
    `Aggregated ${summary.totalRuns} benchmark runs${
      latestOnly ? ' from the latest benchmark execution' : ''
    }. JSON: ${outputJson}. Markdown: ${outputMarkdown}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
