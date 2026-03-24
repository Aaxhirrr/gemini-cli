/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import {
  MessageType,
  type HistoryItemBenchmarkDashboard,
  type BenchmarkDashboardLatestRun,
  type BenchmarkRepositoryCard,
} from '../types.js';

interface BenchmarkManifest {
  benchmarkId: string;
  benchmarkVersion: string;
  repositories: Array<{
    repositoryId: string;
    repositoryFile: string;
  }>;
}

interface RepositorySpec {
  repositoryId: string;
  title: string;
  defaultBranch?: string;
  languages: string[];
  frameworks?: string[];
  source?: {
    url?: string;
    pinnedCommit?: string;
    license?: string;
  };
  tasks: Array<{
    taskId: string;
  }>;
}

interface DatasetValidationSummary {
  benchmarkId: string;
  benchmarkVersion: string;
  repositoryCount: number;
  taskCount: number;
  warnings?: string[];
}

interface AggregateSummary {
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
}

interface LastRunSummary {
  runMode?: string;
}

const BENCHMARK_MANIFEST_PATH = path.join(
  'benchmarks',
  'long-context',
  'manifest.json',
);
const BENCHMARK_ARTIFACT_DIR = path.join(
  'artifacts',
  'long-context-benchmark',
);

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const contents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(contents) as T;
}

async function findBenchmarkRepoRoot(startDir: string): Promise<string | null> {
  let current = path.resolve(startDir);

  while (true) {
    const manifestPath = path.join(current, BENCHMARK_MANIFEST_PATH);
    if (await pathExists(manifestPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function loadRepositoryCards(
  repoRoot: string,
  manifest: BenchmarkManifest,
): Promise<BenchmarkRepositoryCard[]> {
  const manifestPath = path.join(repoRoot, BENCHMARK_MANIFEST_PATH);
  const cards = await Promise.all(
    manifest.repositories.map(async (repositoryRef) => {
      const repositoryFile = path.resolve(
        path.dirname(manifestPath),
        repositoryRef.repositoryFile,
      );
      const repository = await readJsonFile<RepositorySpec>(repositoryFile);
      return {
        repositoryId: repository.repositoryId,
        title: repository.title,
        languages: repository.languages,
        frameworks: repository.frameworks || [],
        taskCount: repository.tasks.length,
        defaultBranch: repository.defaultBranch || 'main',
        pinnedCommit: repository.source?.pinnedCommit || 'unversioned',
        sourceUrl: repository.source?.url || 'unknown',
        status: repository.tasks.length > 0 ? 'runnable' : 'intake-only',
      } satisfies BenchmarkRepositoryCard;
    }),
  );

  return cards.sort((left, right) =>
    left.repositoryId.localeCompare(right.repositoryId),
  );
}

function buildLatestRunSummary(
  aggregate: AggregateSummary | null,
  lastRun: LastRunSummary | null,
  labelOverride?: string,
): BenchmarkDashboardLatestRun | undefined {
  if (!aggregate) {
    return undefined;
  }

  return {
    label:
      labelOverride ||
      (lastRun?.runMode ? `${lastRun.runMode} run` : 'Latest run'),
    totalRuns: aggregate.totalRuns,
    passed: aggregate.passed,
    failed: aggregate.failed,
    errored: aggregate.errored,
    partial: aggregate.partial,
    byRepository: aggregate.byRepository,
    byFailureCategory: aggregate.byFailureCategory,
    byLanguage: aggregate.byLanguage,
    byModel: aggregate.byModel,
  };
}

async function loadBenchmarkDashboard(
  repoRoot: string,
  labelOverride?: string,
): Promise<HistoryItemBenchmarkDashboard> {
  const manifestPath = path.join(repoRoot, BENCHMARK_MANIFEST_PATH);
  const artifactDir = path.join(repoRoot, BENCHMARK_ARTIFACT_DIR);

  const manifest = await readJsonFile<BenchmarkManifest>(manifestPath);
  const repositories = await loadRepositoryCards(repoRoot, manifest);
  const datasetValidationPath = path.join(artifactDir, 'dataset-validation.json');
  const aggregateSummaryPath = path.join(artifactDir, 'aggregate-summary.json');
  const lastRunSummaryPath = path.join(artifactDir, 'last-run-summary.json');

  const datasetValidation = (await pathExists(datasetValidationPath))
    ? await readJsonFile<DatasetValidationSummary>(datasetValidationPath)
    : null;
  const aggregateSummary = (await pathExists(aggregateSummaryPath))
    ? await readJsonFile<AggregateSummary>(aggregateSummaryPath)
    : null;
  const lastRunSummary = (await pathExists(lastRunSummaryPath))
    ? await readJsonFile<LastRunSummary>(lastRunSummaryPath)
    : null;

  const taskCount = repositories.reduce(
    (total, repository) => total + repository.taskCount,
    0,
  );
  const repositoriesWithTasks = repositories.filter(
    (repository) => repository.taskCount > 0,
  ).length;

  return {
    type: 'benchmark_dashboard',
    benchmarkId:
      datasetValidation?.benchmarkId || manifest.benchmarkId || 'unknown',
    benchmarkVersion:
      datasetValidation?.benchmarkVersion ||
      manifest.benchmarkVersion ||
      'unknown',
    repositoryCount: datasetValidation?.repositoryCount || repositories.length,
    taskCount: datasetValidation?.taskCount || taskCount,
    repositoriesWithTasks,
    metadataOnlyRepositories: repositories.length - repositoriesWithTasks,
    warnings: datasetValidation?.warnings || [],
    repositories,
    latestRun: buildLatestRunSummary(
      aggregateSummary,
      lastRunSummary,
      labelOverride,
    ),
  };
}

function getBenchmarkRootError() {
  return 'Long-context benchmark dataset not found from the current workspace.';
}

async function resolveBenchmarkRepoRoot(context: CommandContext) {
  const projectRoot =
    context.services.config?.getProjectRoot() || process.cwd();
  return findBenchmarkRepoRoot(projectRoot);
}

async function showBenchmarkDashboard(
  context: CommandContext,
  labelOverride?: string,
) {
  const repoRoot = await resolveBenchmarkRepoRoot(context);
  if (!repoRoot) {
    context.ui.addItem({
      type: MessageType.ERROR,
      text: getBenchmarkRootError(),
    });
    return;
  }

  const dashboard = await loadBenchmarkDashboard(repoRoot, labelOverride);
  context.ui.addItem(dashboard);
}

function runNpmScript(
  repoRoot: string,
  scriptName: string,
): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const command =
      process.platform === 'win32'
        ? 'cmd.exe'
        : process.platform === 'darwin' || process.platform === 'linux'
          ? 'npm'
          : 'npm';
    const args =
      process.platform === 'win32'
        ? ['/d', '/s', '/c', `npm run ${scriptName}`]
        : ['run', scriptName];

    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(Buffer.from(chunk));
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (exitCode) => {
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
    });
  });
}

function summarizeProcessFailure(stdout: string, stderr: string) {
  const combined = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
  return combined.split(/\r?\n/).slice(-8).join('\n');
}

async function runBenchmarkLane(
  context: CommandContext,
  scriptName: string,
  label: string,
) {
  const repoRoot = await resolveBenchmarkRepoRoot(context);
  if (!repoRoot) {
    context.ui.addItem({
      type: MessageType.ERROR,
      text: getBenchmarkRootError(),
    });
    return;
  }

  context.ui.setPendingItem({
    type: MessageType.INFO,
    text: `Running ${label} benchmark lane...`,
  });

  try {
    const result = await runNpmScript(repoRoot, scriptName);

    if (result.exitCode !== 0) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: `Benchmark lane failed: ${label}\n${summarizeProcessFailure(
          result.stdout,
          result.stderr,
        )}`,
      });
      return;
    }

    const dashboard = await loadBenchmarkDashboard(repoRoot, label);
    context.ui.addItem(dashboard);
  } finally {
    context.ui.setPendingItem(null);
  }
}

async function defaultAction(context: CommandContext) {
  await showBenchmarkDashboard(context);
}

async function reportAction(context: CommandContext) {
  await showBenchmarkDashboard(context, 'Latest benchmark report');
}

async function runSmokeAction(context: CommandContext) {
  await runBenchmarkLane(context, 'bench:long-context:smoke', 'smoke');
}

async function runRealRepoAction(context: CommandContext) {
  await runBenchmarkLane(
    context,
    'bench:long-context:real-repo-analysis',
    'real-repo analysis',
  );
}

export const benchmarkCommand: SlashCommand = {
  name: 'benchmark',
  altNames: ['bench'],
  description:
    'Show and run the long-context benchmark. Usage: /benchmark [report|run smoke|run real]',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  action: defaultAction,
  subCommands: [
    {
      name: 'report',
      description: 'Show the latest long-context benchmark dashboard',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: reportAction,
    },
    {
      name: 'run',
      description: 'Run benchmark lanes. Usage: /benchmark run [smoke|real]',
      kind: CommandKind.BUILT_IN,
      autoExecute: false,
      subCommands: [
        {
          name: 'smoke',
          description: 'Run the single-task smoke lane and show the dashboard',
          kind: CommandKind.BUILT_IN,
          autoExecute: true,
          action: runSmokeAction,
        },
        {
          name: 'real',
          altNames: ['real-repo-analysis'],
          description:
            'Run the 10-task real-repo analysis lane and show the dashboard',
          kind: CommandKind.BUILT_IN,
          autoExecute: true,
          action: runRealRepoAction,
        },
      ],
    },
  ],
};
