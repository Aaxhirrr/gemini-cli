import fs from 'node:fs/promises';
import path from 'node:path';

export async function validate({ workspaceDir }) {
  const cachingDoc = await fs.readFile(
    path.join(workspaceDir, 'docs', 'caching.md'),
    'utf8',
  );
  const architectureDoc = await fs.readFile(
    path.join(workspaceDir, 'docs', 'architecture.md'),
    'utf8',
  );

  if (!cachingDoc.includes('authRefreshWindowSeconds')) {
    return {
      status: 'failed',
      summary: 'Caching guide must mention authRefreshWindowSeconds.',
    };
  }

  if (!/single cache\s+freshness budget/.test(architectureDoc)) {
    return {
      status: 'failed',
      summary:
        'Architecture notes must explain the single cache freshness budget.',
    };
  }

  return {
    status: 'passed',
    summary: 'Validator confirmed the long-context cache freshness invariant.',
  };
}
