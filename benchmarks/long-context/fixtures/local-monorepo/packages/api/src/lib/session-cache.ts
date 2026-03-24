import { MemoryCache } from './cache.js';
import type { AppConfig, SessionSummary } from './types.js';

export function createSessionCache(
  config: AppConfig,
): MemoryCache<string, SessionSummary> {
  return new MemoryCache<string, SessionSummary>({
    ttlMs: config.sessionCacheTtlSeconds * 1000,
  });
}
