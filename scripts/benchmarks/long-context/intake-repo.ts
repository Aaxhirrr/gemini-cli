/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
  const manifestPath = path.join(benchmarkRoot, 'manifest.json');
  const repositoryId =
    (options['repository-id'] as string | undefined) ||
    process.env['LONG_CONTEXT_BENCHMARK_TARGET_REPO'];

  if (!repositoryId) {
    printUsage(
      [
        '--repository-id <id>         Repository identifier to scaffold.',
        '--title <text>               Human-readable repository title.',
        '--description <text>         Short repository description.',
        '--fixture-root <path>        Optional fixture root relative to repository.json.',
        '',
        'No repository id was provided, so intake was skipped.',
      ],
      { command: 'tsx ./scripts/benchmarks/long-context/intake-repo.ts' },
    );
    return;
  }

  const manifest = await readJsonFile<{
    repositories: Array<{
      repositoryId: string;
      repositoryFile: string;
      tags?: string[];
    }>;
  }>(manifestPath);

  const repositoryDir = path.join(benchmarkRoot, 'repos', repositoryId);
  await ensureDir(repositoryDir);
  const repositoryFile = path.join(repositoryDir, 'repository.json');

  await writeJsonFile(repositoryFile, {
    $schema: '../../schemas/repository.schema.json',
    schemaVersion: '1.0.0',
    repositoryId,
    title: (options['title'] as string | undefined) || repositoryId,
    description:
      (options['description'] as string | undefined) ||
      `Curated long-context repository ${repositoryId}.`,
    fixtureRoot:
      (options['fixture-root'] as string | undefined) || '../../fixtures/TODO',
    defaultBranch: 'main',
    source: {
      kind: 'synthetic',
      createdAt: new Date().toISOString().slice(0, 10),
      seed: 'replace-me',
    },
    languages: ['typescript'],
    stats: {
      approxFileCount: 1,
      approxTokenCount: 1,
      entrypointFiles: [],
    },
    tasks: [],
  });

  if (
    !manifest.repositories.some(
      (repository) => repository.repositoryId === repositoryId,
    )
  ) {
    manifest.repositories.push({
      repositoryId,
      repositoryFile: `./repos/${repositoryId}/repository.json`,
      tags: ['curation-pending'],
    });
    await writeJsonFile(manifestPath, manifest);
  }

  process.stdout.write(
    `Scaffolded benchmark repository at ${repositoryFile}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
