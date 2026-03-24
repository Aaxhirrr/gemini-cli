import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AppConfig } from './lib/types.js';

function loadDefaults() {
  const defaultsPath = path.resolve(
    process.cwd(),
    'packages',
    'config',
    'defaults.json',
  );

  return JSON.parse(readFileSync(defaultsPath, 'utf8')) as Record<string, number>;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const defaults = loadDefaults();

  return {
    port: env.PORT ? Number(env.PORT) : defaults.port,
    authRefreshWindowSeconds: env.AUTH_REFRESH_WINDOW_SECONDS
      ? Number(env.AUTH_REFRESH_WINDOW_SECONDS)
      : defaults.authRefreshWindowSeconds,
    sessionCacheTtlSeconds: env.SESSION_CACHE_TTL_SECONDS
      ? Number(env.SESSION_CACHE_TTL_SECONDS)
      : defaults.sessionCacheTtlSeconds,
    permissionCacheTtlSeconds: env.PERMISSION_CACHE_TTL_SECONDS
      ? Number(env.PERMISSION_CACHE_TTL_SECONDS)
      : defaults.permissionCacheTtlSeconds,
    notesSyncBatchSize: defaults.notesSyncBatchSize,
  };
}
