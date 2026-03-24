/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020Pkg from '../../../packages/core/node_modules/ajv/dist/2020.js';
import * as addFormats from 'ajv-formats';
import type { SessionMetrics } from '../../../packages/core/src/telemetry/uiTelemetry.js';
import type { JsonOutput } from '../../../packages/core/src/output/types.js';

// Ajv's ESM/CJS interop matches the approach already used in core.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const Ajv2020Class = (Ajv2020Pkg as any).default || Ajv2020Pkg;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const addFormatsFn = (addFormats as any).default || addFormats;

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

export const DEFAULT_BENCHMARK_ROOT = path.join(
  REPO_ROOT,
  'benchmarks',
  'long-context',
);

export const DEFAULT_MANIFEST_PATH = path.join(
  DEFAULT_BENCHMARK_ROOT,
  'manifest.json',
);

export const DEFAULT_ARTIFACT_ROOT = path.join(
  REPO_ROOT,
  'artifacts',
  'long-context-benchmark',
);

export const CLI_ENTRYPOINT = path.join(
  REPO_ROOT,
  'packages',
  'cli',
  'dist',
  'index.js',
);

export type FailureCategory =
  | 'environment_setup'
  | 'navigation_retrieval'
  | 'context_overflow_compression_loss'
  | 'wrong_architectural_scope'
  | 'incorrect_implementation'
  | 'validation_avoidance'
  | 'tool_misuse'
  | 'flaky_task'
  | 'manual_review';

export interface BenchmarkManifest {
  $schema: string;
  schemaVersion: string;
  benchmarkId: string;
  benchmarkVersion: string;
  title: string;
  description: string;
  maintainers: string[];
  supportedRunnerVersion?: string;
  defaultModelMatrix?: Array<{
    model: string;
    label?: string;
  }>;
  shards?: Array<{
    shardId: string;
    title?: string;
    description?: string;
    repositoryIds?: string[];
    taskIds?: string[];
    tags?: string[];
    modes?: string[];
  }>;
  curationRubric?: {
    minimumRepositories?: number;
    targetRepositories?: number;
    requiredLanguageFamilies?: string[];
    fullSnapshotsDefault?: boolean;
  };
  repositories: Array<{
    repositoryId: string;
    repositoryFile: string;
    tags?: string[];
  }>;
}

export interface ValidationCommandSpec {
  command: string;
  workingDirectory?: string;
  description?: string;
  expectExitCode?: number;
}

export interface FileAssertionSpec {
  path: string;
  mustContain?: string[];
  mustNotContain?: string[];
}

export interface GitDiffSpec {
  mustModify?: string[];
  mustNotModify?: string[];
}

export interface ValidationSpec {
  commands?: ValidationCommandSpec[];
  fileAssertions?: FileAssertionSpec[];
  gitDiff?: GitDiffSpec;
  resultMustContain?: string[];
  validatorFile?: string;
}

export interface RepositorySpec {
  $schema: string;
  schemaVersion: string;
  repositoryId: string;
  title: string;
  description: string;
  fixtureRoot?: string;
  defaultBranch?: string;
  source?: {
    kind?: string;
    url?: string;
    archiveFile?: string;
    pinnedCommit?: string;
    createdAt?: string;
    seed?: string;
    extractionJustification?: string;
    license?: string;
  };
  languages: string[];
  frameworks?: string[];
  stats: {
    approxFileCount: number;
    approxTokenCount: number;
    entrypointFiles: string[];
  };
  environment?: {
    profileId?: string;
    setupCommands?: ValidationCommandSpec[];
    resetCommands?: ValidationCommandSpec[];
  };
  tasks: Array<{
    taskId: string;
    taskDirectory: string;
    tags?: string[];
  }>;
}

export interface TaskSpec {
  $schema: string;
  schemaVersion: string;
  taskId: string;
  repositoryId?: string;
  title: string;
  summary: string;
  category: 'code-change' | 'audit' | 'analysis';
  difficulty: 'easy' | 'medium' | 'hard';
  taskFamily?: string;
  promptFile: string;
  curatorNotesFile: string;
  tags: string[];
  targetComponents?: string[];
  recommendedReadFiles: string[];
  expectedTouchedFiles: string[];
  protectedFiles: string[];
  expectedLongContextReasoning?: string;
  acceptanceCriteria?: string[];
  execution?: {
    timeoutMinutes?: number;
    maxPromptTokens?: number;
    maxCostUsd?: number;
    fakeResponsesFile?: string;
    allowedTools?: string[];
    setupCommands?: ValidationCommandSpec[];
    resetCommands?: ValidationCommandSpec[];
  };
  validation: ValidationSpec;
}

export interface LoadedRepository {
  manifestRef: BenchmarkManifest['repositories'][number];
  repositoryFile: string;
  repositoryDir: string;
  sourceRoot: string;
  spec: RepositorySpec;
}

export interface LoadedTask {
  taskDir: string;
  taskFile: string;
  promptFile: string;
  curatorNotesFile: string;
  fakeResponsesFile?: string;
  validatorFile?: string;
  spec: TaskSpec;
  repository: LoadedRepository;
}

export interface LoadedBenchmarkDataset {
  benchmarkRoot: string;
  manifestPath: string;
  manifest: BenchmarkManifest;
  repositories: LoadedRepository[];
  tasks: LoadedTask[];
}

export interface ValidationCheckResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'errored';
  details?: string;
}

export interface CommandCheckResult extends ValidationCheckResult {
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
}

export interface BenchmarkRunResult {
  $schema: string;
  schemaVersion: string;
  benchmarkId: string;
  benchmarkVersion?: string;
  repositoryId: string;
  repositoryLanguages: string[];
  taskId: string;
  taskDifficulty: TaskSpec['difficulty'];
  taskCategory: TaskSpec['category'];
  taskTags: string[];
  model: string;
  runMode: string;
  status: 'passed' | 'failed' | 'errored' | 'partial';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: string;
  failureCategory?: FailureCategory;
  needsManualReview?: boolean;
  resultText?: string;
  filesModified?: string[];
  artifacts: {
    outputDir: string;
    workspaceDir?: string;
    stdoutLog: string;
    stderrLog: string;
    promptSnapshot: string;
    resultJson: string;
    activityLog?: string;
  };
  metrics?: {
    totalTokens: number;
    promptTokens: number;
    candidateTokens: number;
    cachedTokens: number;
    thoughtsTokens: number;
    toolTokens: number;
    toolCalls: number;
    toolCallsByName: Record<string, number>;
    files: {
      totalLinesAdded: number;
      totalLinesRemoved: number;
    };
    contextSignals: {
      compressionMentions: number;
      overflowMentions: number;
      toolMaskingMentions: number;
    };
  };
  validation: {
    commandResults: CommandCheckResult[];
    fileAssertionResults: ValidationCheckResult[];
    gitDiffResults: ValidationCheckResult[];
    resultContentResults: ValidationCheckResult[];
    validatorResult?: ValidationCheckResult;
  };
}

export interface RunTaskOptions {
  benchmarkId: string;
  benchmarkVersion?: string;
  artifactRoot: string;
  runMode: string;
  model: string;
  keepWorkspace?: boolean;
  useFakeResponses?: boolean;
}

export interface RunTaskExecutionResult {
  result: BenchmarkRunResult;
  workspaceDir?: string;
}

export class BenchmarkError extends Error {
  constructor(
    message: string,
    readonly category: FailureCategory = 'environment_setup',
  ) {
    super(message);
    this.name = 'BenchmarkError';
  }
}

export class CliExecutionError extends Error {
  constructor(
    message: string,
    readonly stdout: string,
    readonly stderr: string,
    readonly exitCode: number | null,
  ) {
    super(message);
    this.name = 'CliExecutionError';
  }
}

export function parseCliFlags(argv: string[]) {
  const options: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }

    const body = value.slice(2);
    if (body.includes('=')) {
      const [key, inlineValue] = body.split(/=(.*)/s);
      options[key] = inlineValue;
      continue;
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      options[body] = true;
      continue;
    }

    options[body] = nextValue;
    index += 1;
  }

  return { options, positional };
}

export function printUsage(
  lines: string[],
  {
    command = 'tsx ./scripts/benchmarks/long-context/<script>.ts',
  }: { command?: string } = {},
) {
  const usage = [`Usage: ${command}`, '', ...lines].join('\n');
  process.stdout.write(`${usage}\n`);
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const contents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(contents) as T;
}

export async function writeJsonFile(
  filePath: string,
  value: unknown,
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function resolveBenchmarkRoot(explicitRoot?: string): string {
  if (explicitRoot) {
    return path.resolve(REPO_ROOT, explicitRoot);
  }

  return path.resolve(
    process.env['LONG_CONTEXT_BENCHMARK_ROOT'] || DEFAULT_BENCHMARK_ROOT,
  );
}

export function resolveArtifactRoot(explicitRoot?: string): string {
  return path.resolve(
    explicitRoot ||
      process.env['LONG_CONTEXT_BENCHMARK_ARTIFACT_DIR'] ||
      DEFAULT_ARTIFACT_ROOT,
  );
}

function resolveRelativePath(baseFile: string, relativePath: string): string {
  return path.resolve(path.dirname(baseFile), relativePath);
}

function createAjv() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const ajv = new Ajv2020Class({ allErrors: true, strictSchema: false });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  addFormatsFn(ajv);
  return ajv as {
    addSchema: (schema: object, key?: string) => void;
    compile: (schema: object) => (value: unknown) => boolean;
    errorsText: (errors: unknown, options?: { dataVar?: string }) => string;
  };
}

async function loadSchemaMap(benchmarkRoot: string) {
  const schemaDir = path.join(benchmarkRoot, 'schemas');
  const schemaNames = [
    'benchmark-manifest.schema.json',
    'repository.schema.json',
    'task.schema.json',
    'run-result.schema.json',
  ];
  const entries = await Promise.all(
    schemaNames.map(async (schemaName) => {
      const schemaPath = path.join(schemaDir, schemaName);
      return [schemaName, await readJsonFile<object>(schemaPath)] as const;
    }),
  );

  return new Map(entries);
}

function validateWithSchema(
  ajv: ReturnType<typeof createAjv>,
  schema: object,
  value: unknown,
  label: string,
) {
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    throw new BenchmarkError(
      `Schema validation failed for ${label}: ${ajv.errorsText(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (validate as any).errors,
        { dataVar: label },
      )}`,
    );
  }
}

function assertInsideSourceRoot(
  sourceRoot: string,
  resolvedPath: string,
  label: string,
) {
  const relative = path.relative(sourceRoot, resolvedPath);
  if (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  ) {
    return;
  }

  throw new BenchmarkError(
    `${label} resolves outside the repository source root: ${resolvedPath}`,
  );
}

async function loadTask(
  taskDirectory: string,
  repository: LoadedRepository,
  taskSchema: object,
  ajv: ReturnType<typeof createAjv>,
) {
  const taskFile = path.join(taskDirectory, 'task.json');
  const spec = await readJsonFile<TaskSpec>(taskFile);
  validateWithSchema(ajv, taskSchema, spec, taskFile);

  const promptFile = resolveRelativePath(taskFile, spec.promptFile);
  const curatorNotesFile = resolveRelativePath(taskFile, spec.curatorNotesFile);
  const fakeResponsesFile = spec.execution?.fakeResponsesFile
    ? resolveRelativePath(taskFile, spec.execution.fakeResponsesFile)
    : undefined;
  const validatorFile = spec.validation.validatorFile
    ? resolveRelativePath(taskFile, spec.validation.validatorFile)
    : undefined;

  if (!(await pathExists(promptFile))) {
    throw new BenchmarkError(`Prompt file does not exist: ${promptFile}`);
  }
  if (!(await pathExists(curatorNotesFile))) {
    throw new BenchmarkError(
      `Curator notes file does not exist: ${curatorNotesFile}`,
    );
  }
  if (fakeResponsesFile && !(await pathExists(fakeResponsesFile))) {
    throw new BenchmarkError(
      `Fake responses file does not exist: ${fakeResponsesFile}`,
    );
  }
  if (validatorFile && !(await pathExists(validatorFile))) {
    throw new BenchmarkError(`Validator file does not exist: ${validatorFile}`);
  }

  for (const filePath of spec.recommendedReadFiles) {
    const resolved = resolveRelativePath(taskFile, filePath);
    assertInsideSourceRoot(
      repository.sourceRoot,
      resolved,
      `recommendedReadFiles for ${spec.taskId}`,
    );
  }

  for (const filePath of spec.expectedTouchedFiles) {
    const resolved = resolveRelativePath(taskFile, filePath);
    assertInsideSourceRoot(
      repository.sourceRoot,
      resolved,
      `expectedTouchedFiles for ${spec.taskId}`,
    );
  }

  for (const filePath of spec.protectedFiles) {
    const resolved = resolveRelativePath(taskFile, filePath);
    assertInsideSourceRoot(
      repository.sourceRoot,
      resolved,
      `protectedFiles for ${spec.taskId}`,
    );
  }

  for (const assertion of spec.validation.fileAssertions || []) {
    const resolved = resolveRelativePath(taskFile, assertion.path);
    assertInsideSourceRoot(
      repository.sourceRoot,
      resolved,
      `validation.fileAssertions for ${spec.taskId}`,
    );
  }

  return {
    taskDir: taskDirectory,
    taskFile,
    promptFile,
    curatorNotesFile,
    fakeResponsesFile,
    validatorFile,
    spec,
    repository,
  } satisfies LoadedTask;
}

export async function loadBenchmarkDataset(
  benchmarkRoot: string = resolveBenchmarkRoot(),
): Promise<LoadedBenchmarkDataset> {
  const manifestPath = path.join(benchmarkRoot, 'manifest.json');
  const schemaMap = await loadSchemaMap(benchmarkRoot);
  const ajv = createAjv();

  for (const schema of schemaMap.values()) {
    ajv.addSchema(schema);
  }

  const manifest = await readJsonFile<BenchmarkManifest>(manifestPath);
  validateWithSchema(
    ajv,
    schemaMap.get('benchmark-manifest.schema.json') as object,
    manifest,
    manifestPath,
  );

  const repositories: LoadedRepository[] = [];
  const tasks: LoadedTask[] = [];
  const repositorySchema = schemaMap.get('repository.schema.json') as object;
  const taskSchema = schemaMap.get('task.schema.json') as object;

  for (const repositoryRef of manifest.repositories) {
    const repositoryFile = resolveRelativePath(
      manifestPath,
      repositoryRef.repositoryFile,
    );
    const repositoryDir = path.dirname(repositoryFile);
    const spec = await readJsonFile<RepositorySpec>(repositoryFile);

    validateWithSchema(ajv, repositorySchema, spec, repositoryFile);

    const sourceRoot = spec.fixtureRoot
      ? resolveRelativePath(repositoryFile, spec.fixtureRoot)
      : repositoryDir;

    if (!(await pathExists(sourceRoot))) {
      throw new BenchmarkError(
        `Repository source root does not exist: ${sourceRoot}`,
      );
    }

    const loadedRepository: LoadedRepository = {
      manifestRef: repositoryRef,
      repositoryFile,
      repositoryDir,
      sourceRoot,
      spec,
    };
    repositories.push(loadedRepository);

    for (const taskRef of spec.tasks) {
      const taskDirectory = resolveRelativePath(
        repositoryFile,
        taskRef.taskDirectory,
      );
      if (!(await pathExists(taskDirectory))) {
        throw new BenchmarkError(
          `Task directory does not exist: ${taskDirectory}`,
        );
      }

      const loadedTask = await loadTask(
        taskDirectory,
        loadedRepository,
        taskSchema,
        ajv,
      );

      if (loadedTask.spec.taskId !== taskRef.taskId) {
        throw new BenchmarkError(
          `Task id mismatch between ${repositoryFile} and ${loadedTask.taskFile}`,
        );
      }

      tasks.push(loadedTask);
    }
  }

  validateCrossReferences({
    benchmarkRoot,
    manifestPath,
    manifest,
    repositories,
    tasks,
  });

  return {
    benchmarkRoot,
    manifestPath,
    manifest,
    repositories,
    tasks,
  };
}

export function validateCrossReferences(dataset: LoadedBenchmarkDataset) {
  const repositoryIds = new Set<string>();
  const qualifiedTaskIds = new Set<string>();

  for (const repository of dataset.repositories) {
    if (repositoryIds.has(repository.spec.repositoryId)) {
      throw new BenchmarkError(
        `Duplicate repository id detected: ${repository.spec.repositoryId}`,
      );
    }
    repositoryIds.add(repository.spec.repositoryId);
  }

  for (const task of dataset.tasks) {
    const qualifiedId = `${task.repository.spec.repositoryId}/${task.spec.taskId}`;
    if (qualifiedTaskIds.has(qualifiedId)) {
      throw new BenchmarkError(`Duplicate task id detected: ${qualifiedId}`);
    }
    qualifiedTaskIds.add(qualifiedId);
  }
}

export function evaluateRubricWarnings(dataset: LoadedBenchmarkDataset) {
  const warnings: string[] = [];
  const rubric = dataset.manifest.curationRubric;
  if (!rubric) {
    return warnings;
  }

  if (
    rubric.minimumRepositories &&
    dataset.repositories.length < rubric.minimumRepositories
  ) {
    warnings.push(
      `Dataset currently contains ${dataset.repositories.length} repositories; rubric minimum is ${rubric.minimumRepositories}.`,
    );
  }

  if (rubric.requiredLanguageFamilies?.length) {
    const normalizedLanguages = new Set(
      dataset.repositories.flatMap((repository) =>
        repository.spec.languages.map((language) => language.toLowerCase()),
      ),
    );

    const missingFamilies = rubric.requiredLanguageFamilies.filter(
      (language) => {
        const normalized = language.toLowerCase();
        return !Array.from(normalizedLanguages).some((candidate) =>
          candidate.includes(normalized),
        );
      },
    );

    if (missingFamilies.length > 0) {
      warnings.push(
        `Dataset is still missing rubric language families: ${missingFamilies.join(', ')}.`,
      );
    }
  }

  return warnings;
}

export function selectTasks(
  dataset: LoadedBenchmarkDataset,
  {
    repositoryId,
    taskId,
    shardId,
    mode,
    taskLimit,
  }: {
    repositoryId?: string;
    taskId?: string;
    shardId?: string;
    mode?: string;
    taskLimit?: number;
  } = {},
) {
  let selected = [...dataset.tasks];

  if (repositoryId) {
    selected = selected.filter(
      (task) => task.repository.spec.repositoryId === repositoryId,
    );
  }

  if (taskId) {
    selected = selected.filter(
      (task) =>
        task.spec.taskId === taskId ||
        `${task.repository.spec.repositoryId}/${task.spec.taskId}` === taskId,
    );
  }

  const effectiveShardId =
    shardId ||
    (mode &&
      dataset.manifest.shards?.find((shard) => shard.modes?.includes(mode))
        ?.shardId);

  if (effectiveShardId) {
    const shard = dataset.manifest.shards?.find(
      (candidate) => candidate.shardId === effectiveShardId,
    );
    if (!shard) {
      throw new BenchmarkError(`Unknown shard id: ${effectiveShardId}`);
    }

    selected = selected.filter((task) => {
      const qualifiedId = `${task.repository.spec.repositoryId}/${task.spec.taskId}`;
      const repositoryMatch =
        !shard.repositoryIds || shard.repositoryIds.length === 0
          ? true
          : shard.repositoryIds.includes(task.repository.spec.repositoryId);
      const taskMatch =
        !shard.taskIds || shard.taskIds.length === 0
          ? true
          : shard.taskIds.includes(qualifiedId) ||
            shard.taskIds.includes(task.spec.taskId);
      const tagMatch =
        !shard.tags || shard.tags.length === 0
          ? true
          : shard.tags.some(
              (tag) =>
                task.spec.tags.includes(tag) ||
                task.repository.manifestRef.tags?.includes(tag),
            );

      return repositoryMatch && taskMatch && tagMatch;
    });
  }

  if (taskLimit && taskLimit > 0) {
    selected = selected.slice(0, taskLimit);
  }

  return selected;
}

export function resolveModelMatrix(
  dataset: LoadedBenchmarkDataset,
  mode: string,
) {
  const explicitModel = process.env['LONG_CONTEXT_BENCHMARK_MODEL'];
  if (explicitModel) {
    return [explicitModel];
  }

  if (mode === 'smoke') {
    return ['deterministic-fake'];
  }

  const models =
    dataset.manifest.defaultModelMatrix?.map((entry) => entry.model) || [];
  if (models.length > 0) {
    return models;
  }

  return [process.env['GEMINI_MODEL'] || 'gemini-2.5-pro'];
}

export async function executeCommand(
  command: string,
  {
    cwd,
    env,
    timeoutMs,
  }: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  },
) {
  return new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
  }>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(Buffer.from(chunk));
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    child.on('error', (error) => {
      if (timer) {
        clearTimeout(timer);
      }
      reject(error);
    });

    child.on('close', (exitCode) => {
      if (timer) {
        clearTimeout(timer);
      }
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        timedOut,
      });
    });
  });
}

async function collectRipgrepFallbackMatches(
  searchRoot: string,
  filePath: string,
  pattern: RegExp,
  matches: string[],
) {
  const stats = await fs.stat(filePath);

  if (stats.isDirectory()) {
    const entries = await fs.readdir(filePath);
    for (const entry of entries) {
      await collectRipgrepFallbackMatches(
        searchRoot,
        path.join(filePath, entry),
        pattern,
        matches,
      );
    }
    return;
  }

  let contents = '';
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch {
    return;
  }

  const relativePath = path.relative(searchRoot, filePath).replace(/\\/g, '/');
  const lines = contents.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (pattern.test(line)) {
      matches.push(`${relativePath}:${index + 1}:${line}`);
    }
    pattern.lastIndex = 0;
  }
}

async function executeRipgrepFallback(
  command: string,
  cwd: string,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
} | null> {
  const match = command.match(/^rg\s+-n\s+"([^"]+)"\s+(.+)$/);
  if (!match) {
    return null;
  }

  const [, patternSource, rawTargets] = match;
  const targets = rawTargets
    .split(/\s+/)
    .map((target) => target.trim())
    .filter(Boolean);

  if (targets.length === 0) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'Ripgrep fallback requires at least one target path.',
      timedOut: false,
    };
  }

  const pattern = new RegExp(patternSource);
  const matches: string[] = [];

  for (const target of targets) {
    const targetPath = path.join(cwd, target);
    if (!(await pathExists(targetPath))) {
      continue;
    }
    await collectRipgrepFallbackMatches(cwd, targetPath, pattern, matches);
  }

  return {
    exitCode: matches.length > 0 ? 0 : 1,
    stdout: matches.join('\n'),
    stderr: '',
    timedOut: false,
  };
}

async function executeProcess(
  file: string,
  args: string[],
  {
    cwd,
    env,
    timeoutMs,
  }: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  },
) {
  return new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
  }>((resolve, reject) => {
    const child = spawn(file, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(Buffer.from(chunk));
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    child.on('error', (error) => {
      if (timer) {
        clearTimeout(timer);
      }
      reject(error);
    });

    child.on('close', (exitCode) => {
      if (timer) {
        clearTimeout(timer);
      }
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        timedOut,
      });
    });
  });
}

async function copyDirectory(sourceDir: string, destinationDir: string) {
  await fs.cp(sourceDir, destinationDir, {
    recursive: true,
    force: true,
  });
}

async function initializeWorkspaceGitRepo(workspaceDir: string) {
  await executeCommand('git init', { cwd: workspaceDir });
  await executeCommand('git config user.email "benchmark@example.com"', {
    cwd: workspaceDir,
  });
  await executeCommand('git config user.name "Long Context Benchmark"', {
    cwd: workspaceDir,
  });
  await executeCommand('git add -A', { cwd: workspaceDir });
  await executeCommand('git commit --quiet -m "baseline fixture"', {
    cwd: workspaceDir,
  });
}

async function provisionFromGitSource(
  repository: LoadedRepository,
  workspaceDir: string,
) {
  const sourceUrl = repository.spec.source?.url;
  if (!sourceUrl) {
    throw new BenchmarkError(
      `Repository ${repository.spec.repositoryId} is missing source.url for git provisioning.`,
    );
  }

  const cloneResult = await executeCommand(
    `git clone --quiet "${sourceUrl}" "${workspaceDir}"`,
    {
      cwd: REPO_ROOT,
    },
  );

  if (cloneResult.exitCode !== 0) {
    throw new BenchmarkError(
      `Failed to clone ${sourceUrl}: ${cloneResult.stderr || cloneResult.stdout}`,
    );
  }

  if (repository.spec.source?.pinnedCommit) {
    const checkoutResult = await executeCommand(
      `git checkout --quiet ${repository.spec.source.pinnedCommit}`,
      { cwd: workspaceDir },
    );
    if (checkoutResult.exitCode !== 0) {
      throw new BenchmarkError(
        `Failed to checkout pinned commit ${repository.spec.source.pinnedCommit}: ${checkoutResult.stderr || checkoutResult.stdout}`,
      );
    }
  }
}

async function extractArchive(
  archivePath: string,
  workspaceDir: string,
  cwd: string,
) {
  const lower = archivePath.toLowerCase();
  if (process.platform === 'win32' && lower.endsWith('.zip')) {
    const escapedArchive = archivePath.replace(/'/g, "''");
    const escapedOutput = workspaceDir.replace(/'/g, "''");
    const result = await executeCommand(
      `powershell -NoProfile -Command "Expand-Archive -Force -Path '${escapedArchive}' -DestinationPath '${escapedOutput}'"`,
      { cwd },
    );
    if (result.exitCode !== 0) {
      throw new BenchmarkError(
        `Failed to extract ${archivePath}: ${result.stderr || result.stdout}`,
      );
    }
    return;
  }

  const tarResult = await executeCommand(
    `tar -xf "${archivePath}" -C "${workspaceDir}"`,
    { cwd },
  );
  if (tarResult.exitCode !== 0) {
    throw new BenchmarkError(
      `Failed to extract ${archivePath}: ${tarResult.stderr || tarResult.stdout}`,
    );
  }
}

async function provisionFromArchive(
  repository: LoadedRepository,
  workspaceDir: string,
) {
  const archiveFile = repository.spec.source?.archiveFile;
  if (!archiveFile) {
    throw new BenchmarkError(
      `Repository ${repository.spec.repositoryId} is missing source.archiveFile for archive provisioning.`,
    );
  }
  const archivePath = path.resolve(repository.repositoryDir, archiveFile);
  if (!(await pathExists(archivePath))) {
    throw new BenchmarkError(`Archive file does not exist: ${archivePath}`);
  }
  await extractArchive(archivePath, workspaceDir, repository.repositoryDir);
  const entries = await fs.readdir(workspaceDir);
  if (entries.length === 1) {
    const candidateRoot = path.join(workspaceDir, entries[0]);
    const candidateStats = await fs.stat(candidateRoot);
    if (candidateStats.isDirectory()) {
      const nestedEntries = await fs.readdir(candidateRoot);
      for (const entry of nestedEntries) {
        await fs.rename(
          path.join(candidateRoot, entry),
          path.join(workspaceDir, entry),
        );
      }
      await fs.rm(candidateRoot, { recursive: true, force: true });
    }
  }
  await initializeWorkspaceGitRepo(workspaceDir);
}

export async function provisionWorkspace(repository: LoadedRepository) {
  const tempRoot = await fs.mkdtemp(
    path.join(
      os.tmpdir(),
      `gemini-long-context-${repository.spec.repositoryId}-`,
    ),
  );
  const workspaceDir = path.join(tempRoot, 'workspace');
  await ensureDir(workspaceDir);

  const sourceKind =
    repository.spec.source?.kind ||
    (repository.spec.fixtureRoot ? 'fixture' : 'synthetic');

  if (sourceKind === 'git') {
    await provisionFromGitSource(repository, workspaceDir);
  } else if (sourceKind === 'archive') {
    await provisionFromArchive(repository, workspaceDir);
  } else {
    await copyDirectory(repository.sourceRoot, workspaceDir);
    await initializeWorkspaceGitRepo(workspaceDir);
  }

  return {
    tempRoot,
    workspaceDir,
    cleanup: async () => {
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
  };
}

export function mapTaskPathToWorkspace(
  task: LoadedTask,
  taskRelativePath: string,
  workspaceDir: string,
) {
  const resolvedSourcePath = resolveRelativePath(
    task.taskFile,
    taskRelativePath,
  );
  assertInsideSourceRoot(
    task.repository.sourceRoot,
    resolvedSourcePath,
    `Task path ${taskRelativePath}`,
  );
  const relativePath = path.relative(
    task.repository.sourceRoot,
    resolvedSourcePath,
  );
  return path.join(workspaceDir, relativePath);
}

export async function runValidationCommands(
  task: LoadedTask,
  workspaceDir: string,
) {
  const results: CommandCheckResult[] = [];

  for (const commandSpec of task.spec.validation.commands || []) {
    const commandCwd = commandSpec.workingDirectory
      ? mapTaskPathToWorkspace(task, commandSpec.workingDirectory, workspaceDir)
      : workspaceDir;
    const expectedExitCode = commandSpec.expectExitCode ?? 0;
    const result = await executeCommand(commandSpec.command, {
      cwd: commandCwd,
      timeoutMs: 60_000,
    });
    const fallbackResult =
      result.exitCode !== expectedExitCode &&
      /(^|\s)rg\s/.test(commandSpec.command) &&
      /'rg' is not recognized|rg: command not found/i.test(result.stderr)
        ? await executeRipgrepFallback(commandSpec.command, commandCwd)
        : null;
    const effectiveResult = fallbackResult || result;

    const status =
      effectiveResult.timedOut || effectiveResult.exitCode !== expectedExitCode
        ? 'failed'
        : 'passed';

    results.push({
      name: commandSpec.description || commandSpec.command,
      status,
      details:
        status === 'passed'
          ? undefined
          : `Expected exit code ${expectedExitCode}, received ${effectiveResult.exitCode}${
              effectiveResult.timedOut ? ' (timed out)' : ''
            }.`,
      exitCode: effectiveResult.exitCode,
      stdout: effectiveResult.stdout,
      stderr: effectiveResult.stderr,
    });
  }

  return results;
}

export async function evaluateFileAssertions(
  task: LoadedTask,
  workspaceDir: string,
) {
  const results: ValidationCheckResult[] = [];

  for (const assertion of task.spec.validation.fileAssertions || []) {
    const filePath = mapTaskPathToWorkspace(task, assertion.path, workspaceDir);
    const label = path.relative(workspaceDir, filePath).replace(/\\/g, '/');
    let contents = '';

    try {
      contents = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      results.push({
        name: `file assertion: ${label}`,
        status: 'errored',
        details:
          error instanceof Error ? error.message : `Unable to read ${label}`,
      });
      continue;
    }

    const missing = (assertion.mustContain || []).filter(
      (snippet) => !contents.includes(snippet),
    );
    const forbidden = (assertion.mustNotContain || []).filter((snippet) =>
      contents.includes(snippet),
    );

    results.push({
      name: `file assertion: ${label}`,
      status:
        missing.length === 0 && forbidden.length === 0 ? 'passed' : 'failed',
      details:
        missing.length === 0 && forbidden.length === 0
          ? undefined
          : [
              missing.length > 0
                ? `missing: ${missing.map((item) => JSON.stringify(item)).join(', ')}`
                : undefined,
              forbidden.length > 0
                ? `forbidden: ${forbidden.map((item) => JSON.stringify(item)).join(', ')}`
                : undefined,
            ]
              .filter(Boolean)
              .join('; '),
    });
  }

  return results;
}

async function getModifiedFiles(workspaceDir: string) {
  const result = await executeCommand('git diff --name-only --relative HEAD', {
    cwd: workspaceDir,
  });
  if (result.exitCode !== 0) {
    throw new BenchmarkError(
      `Unable to collect modified files: ${result.stderr || result.stdout}`,
    );
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\\/g, '/'));
}

export async function evaluateGitDiffAssertions(
  task: LoadedTask,
  workspaceDir: string,
) {
  const results: ValidationCheckResult[] = [];
  const modifiedFiles = await getModifiedFiles(workspaceDir);

  for (const filePath of task.spec.validation.gitDiff?.mustModify || []) {
    const expectedRelative = path
      .relative(
        workspaceDir,
        mapTaskPathToWorkspace(task, filePath, workspaceDir),
      )
      .replace(/\\/g, '/');
    results.push({
      name: `git diff must modify: ${expectedRelative}`,
      status: modifiedFiles.includes(expectedRelative) ? 'passed' : 'failed',
      details: modifiedFiles.includes(expectedRelative)
        ? undefined
        : `Modified files were: ${modifiedFiles.join(', ') || '(none)'}`,
    });
  }

  for (const filePath of task.spec.validation.gitDiff?.mustNotModify || []) {
    const expectedRelative = path
      .relative(
        workspaceDir,
        mapTaskPathToWorkspace(task, filePath, workspaceDir),
      )
      .replace(/\\/g, '/');
    results.push({
      name: `git diff must not modify: ${expectedRelative}`,
      status: modifiedFiles.includes(expectedRelative) ? 'failed' : 'passed',
      details: modifiedFiles.includes(expectedRelative)
        ? `Unexpected modification detected for ${expectedRelative}.`
        : undefined,
    });
  }

  return {
    results,
    modifiedFiles,
  };
}

export function evaluateResultContent(task: LoadedTask, resultText: string) {
  const results: ValidationCheckResult[] = [];

  for (const snippet of task.spec.validation.resultMustContain || []) {
    results.push({
      name: `result must contain: ${snippet}`,
      status: resultText.includes(snippet) ? 'passed' : 'failed',
      details: resultText.includes(snippet)
        ? undefined
        : `Assistant result did not contain ${JSON.stringify(snippet)}.`,
    });
  }

  return results;
}

async function runValidatorFile(
  task: LoadedTask,
  workspaceDir: string,
  resultText: string,
) {
  if (!task.validatorFile) {
    return undefined;
  }

  const module = await import(pathToFileURL(task.validatorFile).href);
  if (typeof module.validate !== 'function') {
    return {
      name: 'validatorFile',
      status: 'errored',
      details: 'validatorFile does not export a validate() function.',
    } satisfies ValidationCheckResult;
  }

  const response = (await module.validate({
    workspaceDir,
    resultText,
    task,
    repository: task.repository,
  })) as
    | boolean
    | string
    | {
        status?: string;
        summary?: string;
        details?: string;
      };

  if (typeof response === 'boolean') {
    return {
      name: 'validatorFile',
      status: response ? 'passed' : 'failed',
      details: response ? undefined : 'validatorFile returned false.',
    } satisfies ValidationCheckResult;
  }

  if (typeof response === 'string') {
    return {
      name: 'validatorFile',
      status: 'passed',
      details: response,
    } satisfies ValidationCheckResult;
  }

  const normalizedStatus =
    response.status === 'passed' ||
    response.status === 'failed' ||
    response.status === 'errored' ||
    response.status === 'skipped'
      ? response.status
      : response.status === 'not_implemented'
        ? 'skipped'
        : 'passed';

  return {
    name: 'validatorFile',
    status: normalizedStatus,
    details: response.details || response.summary,
  } satisfies ValidationCheckResult;
}

function countMatches(contents: string, pattern: RegExp) {
  const matches = contents.match(pattern);
  return matches ? matches.length : 0;
}

function summarizeMetrics(
  stats: SessionMetrics | undefined,
  stdout: string,
  stderr: string,
) {
  if (!stats) {
    return undefined;
  }

  const totals = Object.values(stats.models).reduce(
    (accumulator, model) => {
      accumulator.totalTokens += model.tokens.total;
      accumulator.promptTokens += model.tokens.prompt;
      accumulator.candidateTokens += model.tokens.candidates;
      accumulator.cachedTokens += model.tokens.cached;
      accumulator.thoughtsTokens += model.tokens.thoughts;
      accumulator.toolTokens += model.tokens.tool;
      return accumulator;
    },
    {
      totalTokens: 0,
      promptTokens: 0,
      candidateTokens: 0,
      cachedTokens: 0,
      thoughtsTokens: 0,
      toolTokens: 0,
    },
  );

  const combinedOutput = `${stdout}\n${stderr}`;

  return {
    ...totals,
    toolCalls: stats.tools.totalCalls,
    toolCallsByName: Object.fromEntries(
      Object.entries(stats.tools.byName).map(([name, toolStats]) => [
        name,
        toolStats.count,
      ]),
    ),
    files: {
      totalLinesAdded: stats.files.totalLinesAdded,
      totalLinesRemoved: stats.files.totalLinesRemoved,
    },
    contextSignals: {
      compressionMentions: countMatches(combinedOutput, /compress/gi),
      overflowMentions: countMatches(
        combinedOutput,
        /overflow|context window/gi,
      ),
      toolMaskingMentions: countMatches(combinedOutput, /mask/gi),
    },
  };
}

function parseJsonOutput(stdout: string) {
  try {
    return JSON.parse(stdout) as JsonOutput;
  } catch {
    return undefined;
  }
}

function determineRunStatus(validation: BenchmarkRunResult['validation']) {
  const checks = [
    ...validation.commandResults,
    ...validation.fileAssertionResults,
    ...validation.gitDiffResults,
    ...validation.resultContentResults,
    validation.validatorResult,
  ].filter(Boolean) as ValidationCheckResult[];

  if (checks.some((check) => check.status === 'errored')) {
    return 'errored' as const;
  }
  if (checks.some((check) => check.status === 'failed')) {
    return 'failed' as const;
  }
  if (checks.some((check) => check.status === 'skipped')) {
    return 'partial' as const;
  }
  return 'passed' as const;
}

function categorizeFailure(
  runStatus: BenchmarkRunResult['status'],
  commandResults: CommandCheckResult[],
  fileAssertionResults: ValidationCheckResult[],
  gitDiffResults: ValidationCheckResult[],
  resultContentResults: ValidationCheckResult[],
  metrics: BenchmarkRunResult['metrics'],
  stderr: string,
) {
  if (runStatus === 'passed') {
    return undefined;
  }

  if (
    stderr.includes('ENOENT') ||
    stderr.includes('permission denied') ||
    commandResults.some((result) => result.status === 'errored')
  ) {
    return 'environment_setup' as const;
  }

  if ((metrics?.contextSignals.overflowMentions || 0) > 0) {
    return 'context_overflow_compression_loss' as const;
  }

  if (gitDiffResults.some((result) => result.status === 'failed')) {
    return 'wrong_architectural_scope' as const;
  }

  if (resultContentResults.some((result) => result.status === 'failed')) {
    return (metrics?.toolCalls || 0) === 0
      ? ('navigation_retrieval' as const)
      : ('validation_avoidance' as const);
  }

  if (fileAssertionResults.some((result) => result.status === 'failed')) {
    return 'incorrect_implementation' as const;
  }

  if (commandResults.some((result) => result.status === 'failed')) {
    return 'tool_misuse' as const;
  }

  return 'manual_review' as const;
}

function buildSummary(
  status: BenchmarkRunResult['status'],
  failureCategory: FailureCategory | undefined,
  repositoryId: string,
  taskId: string,
) {
  if (status === 'passed') {
    return `Benchmark task ${repositoryId}/${taskId} passed validation.`;
  }

  return `Benchmark task ${repositoryId}/${taskId} ${status} validation with failure category ${failureCategory || 'manual_review'}.`;
}

function sanitizeArtifactSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function getRunResultSchemaPath(task: LoadedTask) {
  return path.resolve(
    task.repository.repositoryDir,
    '..',
    '..',
    'schemas',
    'run-result.schema.json',
  );
}

async function ensureCliEntrypointExists() {
  if (await pathExists(CLI_ENTRYPOINT)) {
    return CLI_ENTRYPOINT;
  }

  throw new BenchmarkError(
    `Gemini CLI build output was not found at ${CLI_ENTRYPOINT}. Run "npm run build" first.`,
  );
}

export async function runBenchmarkTask(
  task: LoadedTask,
  options: RunTaskOptions,
): Promise<RunTaskExecutionResult> {
  const cliEntrypoint = await ensureCliEntrypointExists();
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const runId = new Date(startedAtMs).toISOString().replace(/[:.]/g, '-');
  const modelKey = sanitizeArtifactSegment(options.model);
  const outputDir = path.join(
    options.artifactRoot,
    'runs',
    runId,
    task.repository.spec.repositoryId,
    task.spec.taskId,
    modelKey,
  );
  await ensureDir(outputDir);

  const prompt = await fs.readFile(task.promptFile, 'utf8');
  const promptSnapshot = path.join(outputDir, 'prompt.md');
  await fs.writeFile(promptSnapshot, prompt, 'utf8');

  const stdoutLog = path.join(outputDir, 'stdout.log');
  const stderrLog = path.join(outputDir, 'stderr.log');
  const activityLog = path.join(outputDir, 'activity.jsonl');
  const resultJsonPath = path.join(outputDir, 'result.json');

  const provisioned = await provisionWorkspace(task.repository);
  let stdout = '';
  let stderr = '';
  let parsedOutput: JsonOutput | undefined;

  try {
    for (const command of task.repository.spec.environment?.setupCommands ||
      []) {
      const setupResult = await executeCommand(command.command, {
        cwd: provisioned.workspaceDir,
        timeoutMs: 60_000,
      });
      if (setupResult.exitCode !== (command.expectExitCode ?? 0)) {
        throw new BenchmarkError(
          `Repository setup command failed: ${command.command}\n${setupResult.stderr || setupResult.stdout}`,
        );
      }
    }

    for (const command of task.spec.execution?.setupCommands || []) {
      const setupResult = await executeCommand(command.command, {
        cwd: provisioned.workspaceDir,
        timeoutMs: 60_000,
      });
      if (setupResult.exitCode !== (command.expectExitCode ?? 0)) {
        throw new BenchmarkError(
          `Task setup command failed: ${command.command}\n${setupResult.stderr || setupResult.stdout}`,
        );
      }
    }

    const cliHome = path.join(outputDir, 'cli-home');
    await ensureDir(cliHome);
    await fs.writeFile(
      path.join(cliHome, 'settings.json'),
      `${JSON.stringify(
        {
          output: { format: 'json' },
          ui: { useAlternateBuffer: false },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const shouldUseFakeResponses =
      options.useFakeResponses && task.fakeResponsesFile ? true : false;

    const cliArgs = [
      cliEntrypoint,
      '--prompt',
      prompt,
      '--output-format',
      'json',
      '--allowed-tools',
      'read_file',
      '--allowed-tools',
      'write_file',
      '--allowed-tools',
      'replace',
      '--allowed-tools',
      'glob',
      '--allowed-tools',
      'grep',
      '--allowed-tools',
      'ls',
    ];

    for (const allowedTool of task.spec.execution?.allowedTools || []) {
      cliArgs.push('--allowed-tools', allowedTool);
    }

    if (options.model && options.model !== 'deterministic-fake') {
      cliArgs.push('--model', options.model);
    }

    if (shouldUseFakeResponses && task.fakeResponsesFile) {
      cliArgs.push('--fake-responses', task.fakeResponsesFile);
    }

    const executionTimeoutMs =
      (task.spec.execution?.timeoutMinutes || 5) * 60 * 1000;

    const cliResult = await executeProcess(process.execPath, cliArgs, {
      cwd: provisioned.workspaceDir,
      timeoutMs: executionTimeoutMs,
      env: {
        GEMINI_CLI_HOME: cliHome,
        GEMINI_SANDBOX: 'false',
        GEMINI_CLI_ACTIVITY_LOG_TARGET: activityLog,
        NO_BROWSER: 'true',
      },
    });

    stdout = cliResult.stdout;
    stderr = cliResult.stderr;

    await fs.writeFile(stdoutLog, stdout, 'utf8');
    await fs.writeFile(stderrLog, stderr, 'utf8');

    parsedOutput = parseJsonOutput(stdout);
    if (cliResult.exitCode !== 0) {
      throw new CliExecutionError(
        `Gemini CLI exited with code ${cliResult.exitCode}`,
        stdout,
        stderr,
        cliResult.exitCode,
      );
    }
  } catch (error) {
    if (!(await pathExists(stdoutLog))) {
      await fs.writeFile(stdoutLog, stdout, 'utf8');
    }
    if (!(await pathExists(stderrLog))) {
      await fs.writeFile(stderrLog, stderr, 'utf8');
    }

    const finishedAtMs = Date.now();
    const finishedAt = new Date(finishedAtMs).toISOString();
    const durationMs = finishedAtMs - startedAtMs;
    const failureCategory =
      error instanceof BenchmarkError
        ? error.category
        : error instanceof CliExecutionError
          ? 'environment_setup'
          : 'manual_review';

    const result: BenchmarkRunResult = {
      $schema: path
        .relative(outputDir, getRunResultSchemaPath(task))
        .replace(/\\/g, '/'),
      schemaVersion: '1.0.0',
      benchmarkId: options.benchmarkId,
      benchmarkVersion: options.benchmarkVersion,
      repositoryId: task.repository.spec.repositoryId,
      repositoryLanguages: task.repository.spec.languages,
      taskId: task.spec.taskId,
      taskDifficulty: task.spec.difficulty,
      taskCategory: task.spec.category,
      taskTags: task.spec.tags,
      model: options.model,
      runMode: options.runMode,
      status: 'errored',
      startedAt,
      finishedAt,
      durationMs,
      summary:
        error instanceof Error
          ? error.message
          : 'Benchmark task execution failed.',
      failureCategory,
      needsManualReview: failureCategory === 'manual_review',
      artifacts: {
        outputDir,
        workspaceDir: options.keepWorkspace
          ? provisioned.workspaceDir
          : undefined,
        stdoutLog,
        stderrLog,
        promptSnapshot,
        resultJson: resultJsonPath,
        activityLog,
      },
      validation: {
        commandResults: [],
        fileAssertionResults: [],
        gitDiffResults: [],
        resultContentResults: [],
      },
    };

    await writeJsonFile(resultJsonPath, result);
    if (!options.keepWorkspace) {
      await provisioned.cleanup();
    }
    return {
      result,
      workspaceDir: options.keepWorkspace
        ? provisioned.workspaceDir
        : undefined,
    };
  }

  try {
    const commandResults = await runValidationCommands(
      task,
      provisioned.workspaceDir,
    );
    const fileAssertionResults = await evaluateFileAssertions(
      task,
      provisioned.workspaceDir,
    );
    const gitDiff = await evaluateGitDiffAssertions(
      task,
      provisioned.workspaceDir,
    );
    const resultText = parsedOutput?.response || '';
    const resultContentResults = evaluateResultContent(task, resultText);
    const validatorResult = await runValidatorFile(
      task,
      provisioned.workspaceDir,
      resultText,
    );
    const metrics = summarizeMetrics(parsedOutput?.stats, stdout, stderr);
    const validation = {
      commandResults,
      fileAssertionResults,
      gitDiffResults: gitDiff.results,
      resultContentResults,
      validatorResult,
    };
    const status = determineRunStatus(validation);
    const failureCategory = categorizeFailure(
      status,
      commandResults,
      fileAssertionResults,
      gitDiff.results,
      resultContentResults,
      metrics,
      stderr,
    );
    const finishedAtMs = Date.now();
    const finishedAt = new Date(finishedAtMs).toISOString();
    const durationMs = finishedAtMs - startedAtMs;

    const result: BenchmarkRunResult = {
      $schema: path
        .relative(outputDir, getRunResultSchemaPath(task))
        .replace(/\\/g, '/'),
      schemaVersion: '1.0.0',
      benchmarkId: options.benchmarkId,
      benchmarkVersion: options.benchmarkVersion,
      repositoryId: task.repository.spec.repositoryId,
      repositoryLanguages: task.repository.spec.languages,
      taskId: task.spec.taskId,
      taskDifficulty: task.spec.difficulty,
      taskCategory: task.spec.category,
      taskTags: task.spec.tags,
      model: options.model,
      runMode: options.runMode,
      status,
      startedAt,
      finishedAt,
      durationMs,
      summary: buildSummary(
        status,
        failureCategory,
        task.repository.spec.repositoryId,
        task.spec.taskId,
      ),
      failureCategory,
      needsManualReview: failureCategory === 'manual_review',
      resultText,
      filesModified: gitDiff.modifiedFiles,
      artifacts: {
        outputDir,
        workspaceDir: options.keepWorkspace
          ? provisioned.workspaceDir
          : undefined,
        stdoutLog,
        stderrLog,
        promptSnapshot,
        resultJson: resultJsonPath,
        activityLog,
      },
      metrics,
      validation,
    };

    await writeJsonFile(resultJsonPath, result);

    if (!options.keepWorkspace) {
      await provisioned.cleanup();
    }

    return {
      result,
      workspaceDir: options.keepWorkspace
        ? provisioned.workspaceDir
        : undefined,
    };
  } catch (error) {
    const finishedAtMs = Date.now();
    const finishedAt = new Date(finishedAtMs).toISOString();
    const durationMs = finishedAtMs - startedAtMs;
    const result: BenchmarkRunResult = {
      $schema: path
        .relative(outputDir, getRunResultSchemaPath(task))
        .replace(/\\/g, '/'),
      schemaVersion: '1.0.0',
      benchmarkId: options.benchmarkId,
      benchmarkVersion: options.benchmarkVersion,
      repositoryId: task.repository.spec.repositoryId,
      repositoryLanguages: task.repository.spec.languages,
      taskId: task.spec.taskId,
      taskDifficulty: task.spec.difficulty,
      taskCategory: task.spec.category,
      taskTags: task.spec.tags,
      model: options.model,
      runMode: options.runMode,
      status: 'errored',
      startedAt,
      finishedAt,
      durationMs,
      summary:
        error instanceof Error
          ? error.message
          : 'Benchmark validation stage failed.',
      failureCategory: 'environment_setup',
      artifacts: {
        outputDir,
        workspaceDir: options.keepWorkspace
          ? provisioned.workspaceDir
          : undefined,
        stdoutLog,
        stderrLog,
        promptSnapshot,
        resultJson: resultJsonPath,
        activityLog,
      },
      validation: {
        commandResults: [],
        fileAssertionResults: [],
        gitDiffResults: [],
        resultContentResults: [],
      },
    };

    await writeJsonFile(resultJsonPath, result);
    if (!options.keepWorkspace) {
      await provisioned.cleanup();
    }
    return {
      result,
      workspaceDir: options.keepWorkspace
        ? provisioned.workspaceDir
        : undefined,
    };
  }
}

export async function findRunResultFiles(rootDir: string) {
  if (!(await pathExists(rootDir))) {
    return [] as string[];
  }

  const results: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (entry.name === 'result.json') {
        results.push(nextPath);
      }
    }
  }

  results.sort();
  return results;
}
