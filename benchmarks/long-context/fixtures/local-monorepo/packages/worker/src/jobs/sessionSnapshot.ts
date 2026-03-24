import type { AppConfig, SessionSummary } from '../../../api/src/lib/types.js';

interface SessionService {
  refreshActiveSessions(refreshWindowSeconds: number): Promise<SessionSummary[]>;
}

export async function refreshSessionSnapshots(
  config: AppConfig,
  sessions: SessionService,
): Promise<SessionSummary[]> {
  return sessions.refreshActiveSessions(config.authRefreshWindowSeconds);
}
