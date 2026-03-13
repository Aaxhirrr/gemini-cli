/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useReducer } from 'react';
import type {
  HistoryItem,
  HistoryItemWithoutId,
  IndividualToolCallDisplay,
} from '../types.js';
import {
  CoreToolCallStatus,
  ROOT_SCHEDULER_ID,
  type SerializableConfirmationDetails,
  type Kind,
  type ApprovalMode,
} from '@google/gemini-cli-core';

export type TraceNodeType = 'task' | 'tool' | 'decision' | 'subagent';

export interface TraceNode {
  id: string;
  parentId?: string;
  type: TraceNodeType;
  schedulerId?: string;
  originalRequestName?: string;
  name: string;
  description?: string;
  status: CoreToolCallStatus;
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  errorName?: string;
  errorMessage?: string;
  errorType?: string;

  // Content
  inputPreview?: string;
  resultDisplay?: unknown;
  renderOutputAsMarkdown?: boolean;
  confirmationDetails?: SerializableConfirmationDetails;

  // Execution constraints
  isConfirming?: boolean;
  isClientInitiated?: boolean;
  kind?: Kind;
  ptyId?: number;
  outputFile?: string;
  correlationId?: string;
  approvalMode?: ApprovalMode;
  progressMessage?: string;
  progress?: number;
  progressTotal?: number;

  // Failure path UX
  retryCount?: number;
  hasFailedDescendant?: boolean;

  // Relationships
  children: TraceNode[];
}

interface TraceTreeState {
  nodeMap: Map<string, TraceNode>;
  orderMap: Map<string, number>;
  nextOrder: number;
  tree: TraceNode[];
}

type TraceTreeAction = {
  type: 'sync_snapshot';
  calls: IndividualToolCallDisplay[];
};

const INITIAL_TRACE_TREE_STATE: TraceTreeState = {
  nodeMap: new Map(),
  orderMap: new Map(),
  nextOrder: 0,
  tree: [],
};

const SUBAGENT_NODE_PREFIX = 'subagent:';

function makeSubagentNodeId(schedulerId: string): string {
  return `${SUBAGENT_NODE_PREFIX}${schedulerId}`;
}

function toSubagentName(schedulerId: string): string {
  if (schedulerId.length <= 14) {
    return `Subagent ${schedulerId}`;
  }
  return `Subagent ${schedulerId.slice(0, 10)}`;
}

function deriveSubagentStatus(statuses: CoreToolCallStatus[]): CoreToolCallStatus {
  if (statuses.some((status) => status === CoreToolCallStatus.Error)) {
    return CoreToolCallStatus.Error;
  }
  if (statuses.some((status) => status === CoreToolCallStatus.AwaitingApproval)) {
    return CoreToolCallStatus.AwaitingApproval;
  }
  if (statuses.some((status) => status === CoreToolCallStatus.Executing)) {
    return CoreToolCallStatus.Executing;
  }
  if (statuses.some((status) => status === CoreToolCallStatus.Validating)) {
    return CoreToolCallStatus.Validating;
  }
  if (statuses.some((status) => status === CoreToolCallStatus.Scheduled)) {
    return CoreToolCallStatus.Scheduled;
  }
  if (statuses.length > 0 && statuses.every((status) => status === CoreToolCallStatus.Cancelled)) {
    return CoreToolCallStatus.Cancelled;
  }
  return CoreToolCallStatus.Success;
}

function minDefinedNumber(current: number | undefined, next: number | undefined): number | undefined {
  if (next === undefined) {
    return current;
  }
  if (current === undefined) {
    return next;
  }
  return Math.min(current, next);
}

function maxDefinedNumber(current: number | undefined, next: number | undefined): number | undefined {
  if (next === undefined) {
    return current;
  }
  if (current === undefined) {
    return next;
  }
  return Math.max(current, next);
}

function resolveEffectiveParentId(
  node: TraceNode,
  nodeMap: Map<string, TraceNode>,
): string | undefined {
  if (
    node.type === 'tool' &&
    node.schedulerId &&
    node.schedulerId !== ROOT_SCHEDULER_ID
  ) {
    const subagentId = makeSubagentNodeId(node.schedulerId);
    const originalParentId = node.parentId;
    if (!originalParentId) {
      return subagentId;
    }

    const parentNode = nodeMap.get(originalParentId);
    if (!parentNode || parentNode.schedulerId !== node.schedulerId) {
      return subagentId;
    }
  }

  return node.parentId;
}

/**
 * Recursively marks ancestors of failed nodes with hasFailedDescendant = true.
 * Returns true if this node or any descendant has an Error status.
 */
function propagateFailures(node: TraceNode): boolean {
  let childHasFailure = false;
  for (const child of node.children) {
    if (propagateFailures(child)) {
      childHasFailure = true;
    }
  }
  if (childHasFailure) {
    node.hasFailedDescendant = true;
  }
  return node.status === CoreToolCallStatus.Error || childHasFailure;
}

function collectToolCalls(
  items: Array<HistoryItem | HistoryItemWithoutId>,
): IndividualToolCallDisplay[] {
  const calls: IndividualToolCallDisplay[] = [];
  for (const item of items) {
    if (item.type === 'tool_group') {
      calls.push(...item.tools);
    }
  }
  return calls;
}

function mergeToolCalls(
  committedCalls: IndividualToolCallDisplay[],
  liveCalls: IndividualToolCallDisplay[],
): IndividualToolCallDisplay[] {
  // Keep deterministic order: committed first, then live updates override by callId.
  const mergedById = new Map<string, IndividualToolCallDisplay>();
  for (const call of committedCalls) {
    mergedById.set(call.callId, call);
  }
  for (const call of liveCalls) {
    mergedById.set(call.callId, call);
  }
  return [...mergedById.values()];
}

function syncSnapshotReducer(
  state: TraceTreeState,
  calls: IndividualToolCallDisplay[],
): TraceTreeState {
  const callsById = new Map(calls.map((call) => [call.callId, call]));

  const subagentSnapshots = new Map<
    string,
    {
      id: string;
      schedulerId: string;
      parentId?: string;
      statuses: CoreToolCallStatus[];
      firstOrder: number;
      startTime?: number;
      endTime?: number;
      durationMs?: number;
    }
  >();

  // Clone previous store to keep stable ordering while rebuilding relationships.
  const nextNodeMap = new Map<string, TraceNode>();
  for (const [id, existing] of state.nodeMap.entries()) {
    nextNodeMap.set(id, {
      ...existing,
      retryCount: undefined,
      hasFailedDescendant: undefined,
      children: [],
    });
  }

  const nextOrderMap = new Map(state.orderMap);
  let nextOrder = state.nextOrder;

  // Upsert snapshot calls into node store.
  for (const call of calls) {
    const existing = nextNodeMap.get(call.callId);
    if (existing) {
      existing.parentId = call.parentCallId;
      existing.schedulerId = call.schedulerId;
      existing.originalRequestName = call.originalRequestName;
      existing.name = call.name;
      existing.description = call.description;
      existing.status = call.status;
      existing.startTime = call.startTime;
      existing.endTime = call.endTime;
      existing.durationMs = call.durationMs;
      existing.errorName = call.errorName;
      existing.errorMessage = call.errorMessage;
      existing.errorType = call.errorType;
      existing.resultDisplay = call.resultDisplay;
      existing.renderOutputAsMarkdown = call.renderOutputAsMarkdown;
      existing.confirmationDetails = call.confirmationDetails;
      existing.isConfirming =
        call.status === CoreToolCallStatus.AwaitingApproval;
      existing.isClientInitiated = call.isClientInitiated;
      existing.kind = call.kind;
      existing.ptyId = call.ptyId;
      existing.outputFile = call.outputFile;
      existing.correlationId = call.correlationId;
      existing.approvalMode = call.approvalMode;
      existing.progressMessage = call.progressMessage;
      existing.progress = call.progress;
      existing.progressTotal = call.progressTotal;
      existing.children = [];
    } else {
      nextNodeMap.set(call.callId, {
        id: call.callId,
        parentId: call.parentCallId,
        type: 'tool',
        schedulerId: call.schedulerId,
        originalRequestName: call.originalRequestName,
        name: call.name,
        description: call.description,
        status: call.status,
        startTime: call.startTime,
        endTime: call.endTime,
        durationMs: call.durationMs,
        errorName: call.errorName,
        errorMessage: call.errorMessage,
        errorType: call.errorType,
        resultDisplay: call.resultDisplay,
        renderOutputAsMarkdown: call.renderOutputAsMarkdown,
        confirmationDetails: call.confirmationDetails,
        isConfirming: call.status === CoreToolCallStatus.AwaitingApproval,
        isClientInitiated: call.isClientInitiated,
        kind: call.kind,
        ptyId: call.ptyId,
        outputFile: call.outputFile,
        correlationId: call.correlationId,
        approvalMode: call.approvalMode,
        progressMessage: call.progressMessage,
        progress: call.progress,
        progressTotal: call.progressTotal,
        children: [],
      });
      nextOrderMap.set(call.callId, nextOrder);
      nextOrder += 1;
    }

    const schedulerId = call.schedulerId;
    if (!schedulerId || schedulerId === ROOT_SCHEDULER_ID) {
      continue;
    }

    const subagentId = makeSubagentNodeId(schedulerId);
    const callOrder = nextOrderMap.get(call.callId) ?? Number.MAX_SAFE_INTEGER;

    const existingSnapshot = subagentSnapshots.get(schedulerId);
    if (!existingSnapshot) {
      subagentSnapshots.set(schedulerId, {
        id: subagentId,
        schedulerId,
        statuses: [call.status],
        firstOrder: callOrder,
        startTime: call.startTime,
        endTime: call.endTime,
        durationMs: call.durationMs,
      });
    } else {
      existingSnapshot.statuses.push(call.status);
      existingSnapshot.firstOrder = Math.min(existingSnapshot.firstOrder, callOrder);
      existingSnapshot.startTime = minDefinedNumber(existingSnapshot.startTime, call.startTime);
      existingSnapshot.endTime = maxDefinedNumber(existingSnapshot.endTime, call.endTime);
      existingSnapshot.durationMs = maxDefinedNumber(existingSnapshot.durationMs, call.durationMs);
    }

    const parentCall = call.parentCallId
      ? callsById.get(call.parentCallId)
      : undefined;
    const parentInSameScheduler =
      parentCall && parentCall.schedulerId === schedulerId;

    if (call.parentCallId && !parentInSameScheduler) {
      const snapshot = subagentSnapshots.get(schedulerId);
      if (snapshot && !snapshot.parentId) {
        snapshot.parentId = call.parentCallId;
      }
    }
  }

  for (const snapshot of subagentSnapshots.values()) {
    const status = deriveSubagentStatus(snapshot.statuses);
    const existing = nextNodeMap.get(snapshot.id);
    if (existing) {
      existing.type = 'subagent';
      existing.parentId = snapshot.parentId;
      existing.schedulerId = snapshot.schedulerId;
      existing.name = toSubagentName(snapshot.schedulerId);
      existing.description = `Nested scheduler: ${snapshot.schedulerId}`;
      existing.status = status;
      existing.startTime = snapshot.startTime;
      existing.endTime = snapshot.endTime;
      existing.durationMs = snapshot.durationMs;
      existing.errorName = undefined;
      existing.errorMessage = undefined;
      existing.errorType = undefined;
      existing.resultDisplay = undefined;
      existing.confirmationDetails = undefined;
      existing.isConfirming = status === CoreToolCallStatus.AwaitingApproval;
      existing.isClientInitiated = false;
      existing.kind = undefined;
      existing.ptyId = undefined;
      existing.outputFile = undefined;
      existing.correlationId = undefined;
      existing.approvalMode = undefined;
      existing.progressMessage = undefined;
      existing.progress = undefined;
      existing.progressTotal = undefined;
      existing.children = [];
    } else {
      nextNodeMap.set(snapshot.id, {
        id: snapshot.id,
        parentId: snapshot.parentId,
        type: 'subagent',
        schedulerId: snapshot.schedulerId,
        name: toSubagentName(snapshot.schedulerId),
        description: `Nested scheduler: ${snapshot.schedulerId}`,
        status,
        startTime: snapshot.startTime,
        endTime: snapshot.endTime,
        durationMs: snapshot.durationMs,
        isConfirming: status === CoreToolCallStatus.AwaitingApproval,
        isClientInitiated: false,
        children: [],
      });
    }

    const subagentOrder =
      snapshot.firstOrder === Number.MAX_SAFE_INTEGER
        ? nextOrder
        : snapshot.firstOrder - 0.5;
    nextOrderMap.set(snapshot.id, subagentOrder);
    nextOrder += 1;
  }

  const activeIds = new Set<string>([
    ...calls.map((call) => call.callId),
    ...[...subagentSnapshots.values()].map((snapshot) => snapshot.id),
  ]);

  // Drop stale nodes no longer present in this turn's snapshot.
  for (const id of [...nextNodeMap.keys()]) {
    if (!activeIds.has(id)) {
      nextNodeMap.delete(id);
      nextOrderMap.delete(id);
    }
  }

  const orderedNodes = [...nextNodeMap.values()].sort(
    (a, b) => (nextOrderMap.get(a.id) ?? 0) - (nextOrderMap.get(b.id) ?? 0),
  );

  const roots: TraceNode[] = [];
  const linkedEdges = new Set<string>();
  const effectiveParentById = new Map<string, string | undefined>();

  for (const node of orderedNodes) {
    const effectiveParentId = resolveEffectiveParentId(node, nextNodeMap);
    effectiveParentById.set(node.id, effectiveParentId);

    if (effectiveParentId && nextNodeMap.has(effectiveParentId)) {
      const edgeKey = `${effectiveParentId}->${node.id}`;
      if (!linkedEdges.has(edgeKey)) {
        const parent = nextNodeMap.get(effectiveParentId);
        if (parent) {
          parent.children.push(node);
        }
        linkedEdges.add(edgeKey);
      }
    } else {
      roots.push(node);
    }
  }

  // Compute retry attempt index scoped per parent + original request name.
  const retryAttemptByScope = new Map<string, number>();
  for (const node of orderedNodes) {
    if (node.type !== 'tool') {
      continue;
    }
    const scopeParentId = effectiveParentById.get(node.id);
    const scopeToolName = node.originalRequestName ?? node.name;
    const scopeKey = `${scopeParentId ?? '__root__'}::${scopeToolName}`;
    const attempt = (retryAttemptByScope.get(scopeKey) ?? 0) + 1;
    retryAttemptByScope.set(scopeKey, attempt);
    if (attempt > 1) {
      node.retryCount = attempt;
    }
  }

  // Propagate failure flags up the tree.
  for (const root of roots) {
    propagateFailures(root);
  }

  return {
    nodeMap: nextNodeMap,
    orderMap: nextOrderMap,
    nextOrder,
    tree: roots,
  };
}

function traceTreeReducer(
  state: TraceTreeState,
  action: TraceTreeAction,
): TraceTreeState {
  switch (action.type) {
    case 'sync_snapshot':
      return syncSnapshotReducer(state, action.calls);
    default:
      return state;
  }
}

/**
 * Maintains a persistent, normalized trace store and syncs it from
 * committed turn history + live tool-call updates.
 */
export function useTraceTree(
  history: HistoryItem[],
  pendingItems: HistoryItemWithoutId[],
  liveToolCalls: IndividualToolCallDisplay[] = [],
) {
  const committedCalls = useMemo(
    () => collectToolCalls([...history, ...pendingItems]),
    [history, pendingItems],
  );

  const mergedCalls = useMemo(
    () => mergeToolCalls(committedCalls, liveToolCalls),
    [committedCalls, liveToolCalls],
  );

  const [state, dispatch] = useReducer(
    traceTreeReducer,
    mergedCalls,
    (initialCalls) =>
      syncSnapshotReducer(INITIAL_TRACE_TREE_STATE, initialCalls),
  );

  useEffect(() => {
    dispatch({ type: 'sync_snapshot', calls: mergedCalls });
  }, [mergedCalls]);

  return { tree: state.tree };
}
