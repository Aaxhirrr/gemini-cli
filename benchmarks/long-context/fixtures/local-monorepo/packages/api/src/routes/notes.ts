import type { FastifyInstance } from 'fastify';
import type {
  AppConfig,
  PermissionDecision,
  SessionSummary,
  WorkspacePermission,
} from '../lib/types.js';
import { createPermissionCache } from '../lib/permission-cache.js';

interface AccessService {
  decide(
    summary: SessionSummary,
    workspaceId: string,
    scope: WorkspacePermission,
  ): PermissionDecision;
}

interface SessionService {
  buildSummary(
    sessionId: string,
    refreshWindowSeconds: number,
  ): Promise<SessionSummary>;
}

interface NotesRouteDeps {
  config: AppConfig;
  access: AccessService;
  sessions: SessionService;
}

export function registerNotesRoutes(
  app: FastifyInstance,
  deps: NotesRouteDeps,
): void {
  const permissionCache = createPermissionCache(deps.config);

  app.get('/workspaces/:workspaceId/notes', async (request, reply) => {
    const workspaceId = String(
      (request.params as { workspaceId: string }).workspaceId,
    );
    const sessionId = String(request.headers['x-session-id'] ?? '');
    const cacheKey = `${sessionId}:${workspaceId}:notes:read`;

    let decision = permissionCache.get(cacheKey);

    if (!decision) {
      const summary = await deps.sessions.buildSummary(
        sessionId,
        deps.config.authRefreshWindowSeconds,
      );
      decision = deps.access.decide(summary, workspaceId, 'notes:read');
      permissionCache.set(cacheKey, decision);
    }

    if (!decision.allowed) {
      reply.status(403);
      return { error: 'forbidden' };
    }

    return { workspaceId, notes: [] };
  });
}
