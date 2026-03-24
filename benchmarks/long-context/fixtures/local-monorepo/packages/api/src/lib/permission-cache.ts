import { MemoryCache } from './cache.js';
import type { AppConfig, PermissionDecision } from './types.js';

export function createPermissionCache(
  config: AppConfig,
): MemoryCache<string, PermissionDecision> {
  return new MemoryCache<string, PermissionDecision>({
    ttlMs: config.permissionCacheTtlSeconds * 1000,
  });
}
