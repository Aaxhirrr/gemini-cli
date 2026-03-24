/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  ensureDir,
  parseCliFlags,
  printUsage,
  readJsonFile,
  resolveBenchmarkRoot,
  writeJsonFile,
} from './shared.js';

async function main() {
  const { options } = parseCliFlags(process.argv.slice(2));
  const benchmarkRoot = resolveBenchmarkRoot();
  const repositoryId =
    (options['repository-id'] as string | undefined) ||
    process.env['LONG_CONTEXT_BENCHMARK_TARGET_REPO'];
  const taskId =
    (options['task-id'] as string | undefined) ||
    process.env['LONG_CONTEXT_BENCHMARK_TASK_ID'];

  if (!repositoryId || !taskId) {
    printUsage(
      [
        '--repository-id <id>         Repository identifier.',
        '--task-id <id>               Task identifier to scaffold.',
        '--title <text>               Human-readable task title.',
        '',
        'Missing repository or task id, so scaffolding was skipped.',
      ],
      { command: 'tsx ./scripts/benchmarks/long-context/scaffold-task.ts' },
    );
    return;
  }

  const repositoryFile = path.join(
    benchmarkRoot,
    'repos',
    repositoryId,
    'repository.json',
  );
  const repository = await readJsonFile<{
    tasks: Array<{
      taskId: string;
      taskDirectory: string;
      tags?: string[];
    }>;
  }>(repositoryFile);

  const taskDir = path.join(
    benchmarkRoot,
    'repos',
    repositoryId,
    'tasks',
    taskId,
  );
  await ensureDir(taskDir);

  await writeJsonFile(path.join(taskDir, 'task.json'), {
    $schema: '../../../schemas/task.schema.json',
    schemaVersion: '1.0.0',
    taskId,
    title: (options['title'] as string | undefined) || taskId,
    summary:
      (options['summary'] as string | undefined) ||
      `Curated long-context benchmark task ${taskId}.`,
    category: 'code-change',
    difficulty: 'medium',
    promptFile: './prompt.md',
    curatorNotesFile: './curator-notes.md',
    tags: ['long-context'],
    recommendedReadFiles: [],
    expectedTouchedFiles: [],
    protectedFiles: [],
    validation: {
      resultMustContain: [taskId],
      validatorFile: './validator.js',
    },
  });

  await fs.writeFile(
    path.join(taskDir, 'prompt.md'),
    'Describe the real-world bug or feature here.\n',
    'utf8',
  );
  await fs.writeFile(
    path.join(taskDir, 'curator-notes.md'),
    '# Curator Notes\n\nDocument why this task requires long-context reasoning.\n',
    'utf8',
  );
  await fs.writeFile(
    path.join(taskDir, 'validator.js'),
    [
      'export async function validate() {',
      "  return { status: 'not_implemented', summary: 'Add task-specific validation.' };",
      '}',
      '',
    ].join('\n'),
    'utf8',
  );

  if (!repository.tasks.some((task) => task.taskId === taskId)) {
    repository.tasks.push({
      taskId,
      taskDirectory: `./tasks/${taskId}`,
      tags: ['curation-pending'],
    });
    await writeJsonFile(repositoryFile, repository);
  }

  process.stdout.write(`Scaffolded benchmark task at ${taskDir}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
