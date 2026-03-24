export interface AppConfig {
  port: number;
  authRefreshWindowSeconds: number;
  sessionCacheTtlSeconds: number;
  permissionCacheTtlSeconds: number;
  notesSyncBatchSize: number;
}

export interface SessionSummary {
  sessionId: string;
  userId: string;
  workspaceIds: string[];
  refreshedAt: string;
}

export type WorkspacePermission = 'notes:read' | 'notes:write';

export interface PermissionDecision {
  allowed: boolean;
  scope: WorkspacePermission;
  reason: string;
}
