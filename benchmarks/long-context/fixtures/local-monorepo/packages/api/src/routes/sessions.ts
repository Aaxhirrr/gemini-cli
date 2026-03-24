import type { FastifyInstance } from 'fastify';
import type { AppConfig, SessionSummary } from '../lib/types.js';
import { createSessionCache } from '../lib/session-cache.js';

interface SessionService {
  buildSummary(
    sessionId: string,
    refreshWindowSeconds: number,
  ): Promise<SessionSummary>;
}

interface SessionRouteDeps {
  config: AppConfig;
  sessions: SessionService;
}

export function registerSessionRoutes(
  app: FastifyInstance,
  deps: SessionRouteDeps,
): void {
  const sessionCache = createSessionCache(deps.config);

  app.get('/session', async (request) => {
    const sessionId = String(request.headers['x-session-id'] ?? '');
    const cached = sessionCache.get(sessionId);

    if (cached) {
      return cached;
    }

    const summary = await deps.sessions.buildSummary(
      sessionId,
      deps.config.authRefreshWindowSeconds,
    );

    sessionCache.set(sessionId, summary);
    return summary;
  });
}
