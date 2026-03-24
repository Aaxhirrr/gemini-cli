/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { execSync } from 'node:child_process';

const CHANGE_TARGETS = {
  evals: ['packages/core/src/prompts/', 'packages/core/src/tools/', 'evals/'],
  'long-context-benchmark': [
    'benchmarks/long-context/',
    'scripts/benchmarks/long-context/',
    '.github/workflows/chained_e2e.yml',
    '.github/workflows/evals-nightly.yml',
    '.github/workflows/long-context-benchmark-manual.yml',
    'scripts/changed_prompt.js',
    'package.json',
    'package-lock.json',
  ],
};

function matchesTarget(file, target) {
  if (target.endsWith('/')) {
    return file.startsWith(target);
  }

  return file === target;
}

function getTargets(scope) {
  if (scope in CHANGE_TARGETS) {
    return CHANGE_TARGETS[scope];
  }

  return [...new Set(Object.values(CHANGE_TARGETS).flat())];
}

function main() {
  const scope = process.env.CHANGE_SCOPE || 'evals';
  const targets = getTargets(scope);
  const targetBranch = process.env.GITHUB_BASE_REF || 'main';
  try {
    // Fetch target branch from origin.
    execSync(`git fetch origin ${targetBranch}`, {
      stdio: 'ignore',
    });

    // Find the merge base with the target branch.
    const mergeBase = execSync('git merge-base HEAD FETCH_HEAD', {
      encoding: 'utf-8',
    }).trim();

    // Get changed files
    const changedFiles = execSync(`git diff --name-only ${mergeBase} HEAD`, {
      encoding: 'utf-8',
    })
      .split('\n')
      .filter(Boolean);

    const shouldRun = changedFiles.some((file) =>
      targets.some((target) => matchesTarget(file, target)),
    );

    console.log(shouldRun ? 'true' : 'false');
  } catch (error) {
    // If anything fails (e.g., no git history), run the monitored checks.
    console.warn(
      'Warning: Failed to determine if monitored checks should run. Defaulting to true.',
    );
    console.error(error);
    console.log('true');
  }
}

main();
