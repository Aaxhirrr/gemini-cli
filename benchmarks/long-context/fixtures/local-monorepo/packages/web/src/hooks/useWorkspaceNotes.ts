interface WorkspaceNotesOptions {
  workspaceId: string;
  pollIntervalSeconds: number;
}

export function useWorkspaceNotes(options: WorkspaceNotesOptions) {
  return {
    workspaceId: options.workspaceId,
    pollIntervalMs: options.pollIntervalSeconds * 1000,
    source: 'synthetic-fixture',
  };
}
