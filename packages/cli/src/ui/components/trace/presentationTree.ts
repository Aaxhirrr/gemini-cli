/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreToolCallStatus } from '@google/gemini-cli-core';
import type { HistoryItem, HistoryItemWithoutId } from '../../types.js';
import type { TraceNode } from '../../state/useTraceTree.js';

export const TRACE_TASK_ROOT_ID = 'trace-task-root';

interface BranchDraft {
  id: string;
  hint?: string;
  heuristicKey?: string;
  rootIds: string[];
}

interface BranchSignals {
  hasSearch: boolean;
  hasFileRead: boolean;
  hasFolderRead: boolean;
  hasShell: boolean;
  hasEdit: boolean;
  hasSubagent: boolean;
  texts: string[];
}

function isTraceStatusActive(status: CoreToolCallStatus): boolean {
  return (
    status === CoreToolCallStatus.Scheduled ||
    status === CoreToolCallStatus.Validating ||
    status === CoreToolCallStatus.Executing ||
    status === CoreToolCallStatus.AwaitingApproval
  );
}

function deriveAggregateTraceStatus(
  children: TraceNode[],
  isActiveFallback = false,
): CoreToolCallStatus {
  const childStatuses = children.map((child) => child.status);

  if (childStatuses.some((status) => status === CoreToolCallStatus.Error)) {
    return CoreToolCallStatus.Error;
  }
  if (
    childStatuses.some((status) => status === CoreToolCallStatus.AwaitingApproval)
  ) {
    return CoreToolCallStatus.AwaitingApproval;
  }
  if (childStatuses.some((status) => status === CoreToolCallStatus.Executing)) {
    return CoreToolCallStatus.Executing;
  }
  if (childStatuses.some((status) => status === CoreToolCallStatus.Validating)) {
    return CoreToolCallStatus.Validating;
  }
  if (childStatuses.some((status) => status === CoreToolCallStatus.Scheduled)) {
    return CoreToolCallStatus.Scheduled;
  }
  if (
    childStatuses.length > 0 &&
    childStatuses.every((status) => status === CoreToolCallStatus.Cancelled)
  ) {
    return CoreToolCallStatus.Cancelled;
  }
  if (isActiveFallback) {
    return CoreToolCallStatus.Executing;
  }
  return CoreToolCallStatus.Success;
}

function cleanInline(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }

  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function collectRootIdByDescendantId(
  rootNodes: TraceNode[],
): Map<string, string> {
  const rootIdByDescendantId = new Map<string, string>();

  const visit = (node: TraceNode, rootId: string) => {
    rootIdByDescendantId.set(node.id, rootId);
    for (const child of node.children) {
      visit(child, rootId);
    }
  };

  for (const rootNode of rootNodes) {
    visit(rootNode, rootNode.id);
  }

  return rootIdByDescendantId;
}

function toDisplayCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((segment) =>
      segment.length === 0
        ? segment
        : `${segment[0].toUpperCase()}${segment.slice(1)}`,
    )
    .join('');
}

function extractQuotedValue(description: string | undefined): string | undefined {
  if (!description) {
    return undefined;
  }

  const singleQuoteMatch = description.match(/'([^']+)'/);
  if (singleQuoteMatch?.[1]) {
    return singleQuoteMatch[1];
  }

  const doubleQuoteMatch = description.match(/"([^"]+)"/);
  return doubleQuoteMatch?.[1];
}

function extractSearchSummary(description: string | undefined): string | undefined {
  const quotedValue = extractQuotedValue(description);
  if (quotedValue) {
    return quotedValue;
  }

  const cleaned = cleanInline(description);
  if (!cleaned) {
    return undefined;
  }

  return cleaned
    .replace(/^Searching the web for:\s*/i, '')
    .replace(/\s+within\s+.+$/i, '')
    .replace(/\s+in\s+.+$/i, '')
    .trim();
}

function extractShellSummary(description: string | undefined): string | undefined {
  const cleaned = cleanInline(description);
  if (!cleaned) {
    return undefined;
  }

  return cleaned
    .replace(/\s+\[in\s+.+$/i, '')
    .replace(/\s+\[current working directory.+$/i, '')
    .trim();
}

function extractReadManyFilesSummary(
  description: string | undefined,
): string | undefined {
  const cleaned = cleanInline(description);
  if (!cleaned) {
    return undefined;
  }

  const includeMatch = cleaned.match(/using patterns:\s*(.+?)\s*\(within target/i);
  if (includeMatch?.[1]) {
    return includeMatch[1].replace(/[`']/g, '');
  }

  return cleaned;
}

function getNodeOperationKind(node: TraceNode): string {
  if (node.type === 'subagent') {
    return 'subagent';
  }

  const requestName = (node.originalRequestName ?? node.name).toLowerCase();

  if (
    requestName.includes('grep') ||
    requestName.includes('ripgrep') ||
    requestName.includes('search') ||
    requestName.includes('glob')
  ) {
    return 'search';
  }

  if (requestName === 'ls' || requestName.includes('folder')) {
    return 'read_folder';
  }

  if (requestName.includes('read_many_files')) {
    return 'read_many_files';
  }

  if (requestName.includes('read_file') || requestName === 'open') {
    return 'read_file';
  }

  if (requestName.includes('shell') || requestName.includes('command')) {
    return 'shell';
  }

  if (
    requestName.includes('edit') ||
    requestName.includes('write') ||
    requestName.includes('replace') ||
    requestName.includes('patch')
  ) {
    return 'edit';
  }

  return requestName;
}

function formatToolNode(node: TraceNode): Pick<
  TraceNode,
  'name' | 'description' | 'inputPreview'
> {
  if (node.type !== 'tool' && node.type !== 'subagent') {
    return {
      name: node.name,
      description: node.description,
      inputPreview: node.inputPreview,
    };
  }

  if (node.type === 'subagent') {
    return {
      name: 'Delegate',
      description: cleanInline(node.description) ?? node.name,
      inputPreview: cleanInline(node.description),
    };
  }

  const operationKind = getNodeOperationKind(node);
  const rawDescription = cleanInline(node.description);

  switch (operationKind) {
    case 'search':
      return {
        name: 'SearchText',
        description: extractSearchSummary(rawDescription) ?? rawDescription,
        inputPreview: rawDescription,
      };
    case 'read_folder':
      return {
        name: 'ReadFolder',
        description: rawDescription,
        inputPreview: rawDescription,
      };
    case 'read_many_files':
      return {
        name: 'ReadFiles',
        description: extractReadManyFilesSummary(rawDescription),
        inputPreview: rawDescription,
      };
    case 'read_file':
      return {
        name: 'ReadFile',
        description: rawDescription,
        inputPreview: rawDescription,
      };
    case 'shell':
      return {
        name: 'RunCommand',
        description: extractShellSummary(rawDescription) ?? rawDescription,
        inputPreview: rawDescription,
      };
    case 'edit':
      return {
        name: 'ApplyChange',
        description: rawDescription,
        inputPreview: rawDescription,
      };
    default:
      return {
        name: toDisplayCase(node.originalRequestName ?? node.name),
        description: rawDescription,
        inputPreview: rawDescription,
      };
  }
}

function cloneToolSubtree(node: TraceNode, parentId?: string): TraceNode {
  const formatted = formatToolNode(node);

  const cloned: TraceNode = {
    ...node,
    parentId,
    originalRequestName: node.originalRequestName ?? node.name,
    name: formatted.name,
    description: formatted.description,
    inputPreview: formatted.inputPreview,
    children: [],
  };

  cloned.children = node.children.map((child) => cloneToolSubtree(child, cloned.id));

  return cloned;
}

function collectBranchSignals(nodes: TraceNode[]): BranchSignals {
  const signals: BranchSignals = {
    hasSearch: false,
    hasFileRead: false,
    hasFolderRead: false,
    hasShell: false,
    hasEdit: false,
    hasSubagent: false,
    texts: [],
  };

  const visit = (node: TraceNode) => {
    const operationKind = getNodeOperationKind(node);
    const description = cleanInline(node.description);

    if (operationKind === 'search') {
      signals.hasSearch = true;
    } else if (operationKind === 'read_file') {
      signals.hasFileRead = true;
    } else if (operationKind === 'read_folder') {
      signals.hasFolderRead = true;
    } else if (operationKind === 'shell') {
      signals.hasShell = true;
    } else if (operationKind === 'edit') {
      signals.hasEdit = true;
    } else if (operationKind === 'subagent') {
      signals.hasSubagent = true;
    }

    if (description) {
      signals.texts.push(description.toLowerCase());
    }
    signals.texts.push((node.originalRequestName ?? node.name).toLowerCase());

    for (const child of node.children) {
      visit(child);
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return signals;
}

function matchesAny(text: string, expressions: RegExp[]): boolean {
  return expressions.some((expression) => expression.test(text));
}

function deriveBranchLabelFromSignals(signals: BranchSignals): string {
  const combinedText = signals.texts.join(' ');

  if (
    matchesAny(combinedText, [
      /\bsummar(y|ize|izing)\b/i,
      /\barchitecture\b/i,
      /\bfinal answer\b/i,
      /\breport\b/i,
      /\bfindings\b/i,
    ])
  ) {
    return 'Summarize architecture';
  }

  if (
    matchesAny(combinedText, [
      /packages\/core\/src\/config/i,
      /\bconfigparameters\b/i,
      /\bexport class config\b/i,
      /\bcore config\b/i,
    ])
  ) {
    return 'Trace core Config lifecycle';
  }

  if (
    matchesAny(combinedText, [
      /settings\.ts/i,
      /\bloadsettings\b/i,
      /\bsettings merge\b/i,
      /\bmerge settings\b/i,
    ])
  ) {
    return 'Trace settings merge flow';
  }

  if (
    matchesAny(combinedText, [
      /packages\/cli\/src\/gemini\.tsx/i,
      /\bloadcliconfig\b/i,
      /\bcli initialization\b/i,
      /\bgemini\.tsx\b/i,
    ])
  ) {
    return 'Trace CLI initialization';
  }

  if (
    signals.hasSearch &&
    signals.hasFolderRead &&
    matchesAny(combinedText, [
      /\bconfig\b/i,
      /\bsettings\b/i,
      /\bloadconfig\b/i,
      /\bloadsettings\b/i,
      /\bentrypoint\b/i,
    ])
  ) {
    return 'Discover config entrypoints';
  }

  if (signals.hasSubagent) {
    return 'Delegate to nested agent';
  }

  if (signals.hasSearch && signals.hasFileRead) {
    return 'Trace relevant code paths';
  }

  if (signals.hasSearch || signals.hasFolderRead) {
    return 'Discover relevant files';
  }

  if (signals.hasFileRead) {
    return 'Inspect source files';
  }

  if (signals.hasShell) {
    return 'Run commands';
  }

  if (signals.hasEdit) {
    return 'Apply changes';
  }

  return 'Summarize architecture';
}

function deriveHeuristicBranchKey(nodes: TraceNode[]): string {
  return deriveBranchLabelFromSignals(collectBranchSignals(nodes)).toLowerCase();
}

function normalizeThoughtLabel(thoughtHint: string | undefined): string | undefined {
  const cleaned = thoughtHint
    ?.replace(/[.:\s]+$/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();

  if (!cleaned) {
    return undefined;
  }

  let normalized = cleaned;
  const prefixPatterns = [
    /^(i(?:\s+am|'m)?\s+going\s+to)\s+/i,
    /^(i(?:'ll|\s+will))\s+/i,
    /^(let me)\s+/i,
    /^(now|next|then),\s+/i,
    /^(continuing|continue)\s+to\s+/i,
    /^(we(?:'ll|\s+will))\s+/i,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of prefixPatterns) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, '').trim();
        changed = true;
      }
    }
  }

  if (matchesAny(normalized, [/^model reasoning$/i, /^continue$/i])) {
    return undefined;
  }

  const lowered = normalized.toLowerCase();

  if (
    matchesAny(lowered, [
      /\bsummary\b/i,
      /\bsummarize\b/i,
      /\barchitecture\b/i,
      /\bfindings\b/i,
    ])
  ) {
    return 'Summarize architecture';
  }

  if (
    matchesAny(lowered, [
      /\bcore\b/i,
      /\bconfigparameters\b/i,
      /\bclass config\b/i,
    ])
  ) {
    return 'Trace core Config lifecycle';
  }

  if (matchesAny(lowered, [/\bsettings\b/i, /\bloadsettings\b/i, /\bmerge\b/i])) {
    return 'Trace settings merge flow';
  }

  if (
    matchesAny(lowered, [
      /\bcli\b/i,
      /\bgemini\.tsx\b/i,
      /\bloadcliconfig\b/i,
      /\binitialization\b/i,
    ])
  ) {
    return 'Trace CLI initialization';
  }

  if (
    matchesAny(lowered, [
      /\bentrypoint\b/i,
      /\bentry point\b/i,
      /\brepo structure\b/i,
      /\bconfig\b/i,
    ]) &&
    matchesAny(lowered, [/\bsearch\b/i, /\bfind\b/i, /\blocate\b/i, /\bdiscover\b/i])
  ) {
    return 'Discover config entrypoints';
  }

  const sentence = normalized.replace(/\s+/g, ' ').trim();
  return sentence.length > 0
    ? `${sentence[0].toUpperCase()}${sentence.slice(1)}`
    : undefined;
}

function finalizeBranchLabel(
  hint: string | undefined,
  roots: TraceNode[],
): string {
  const normalizedThoughtLabel = normalizeThoughtLabel(hint);
  if (normalizedThoughtLabel) {
    return normalizedThoughtLabel;
  }

  return deriveBranchLabelFromSignals(collectBranchSignals(roots));
}

function hasActiveDescendant(nodes: TraceNode[]): boolean {
  return nodes.some(
    (node) =>
      isTraceStatusActive(node.status) || hasActiveDescendant(node.children),
  );
}

function hasFailure(nodes: TraceNode[]): boolean {
  return nodes.some(
    (node) =>
      node.status === CoreToolCallStatus.Error ||
      node.hasFailedDescendant === true ||
      hasFailure(node.children),
  );
}

function createPendingNode(parentId: string): TraceNode {
  return {
    id: `${parentId}:pending`,
    parentId,
    type: 'tool',
    name: 'pending',
    description: 'Waiting for the next step',
    status: CoreToolCallStatus.Scheduled,
    children: [],
  };
}

function buildBranchDrafts(
  rootNodes: TraceNode[],
  items: Array<HistoryItem | HistoryItemWithoutId>,
): BranchDraft[] {
  const rootNodeById = new Map(rootNodes.map((node) => [node.id, node]));
  const rootIdByDescendantId = collectRootIdByDescendantId(rootNodes);
  const assignedRootIds = new Set<string>();
  const drafts: BranchDraft[] = [];
  let draftCounter = 0;
  let currentBranch: BranchDraft | undefined;

  const createDraft = (
    hint?: string,
    heuristicKey?: string,
  ): BranchDraft => {
    const draft: BranchDraft = {
      id: `trace-branch-${draftCounter + 1}`,
      hint,
      heuristicKey,
      rootIds: [],
    };
    draftCounter += 1;
    drafts.push(draft);
    return draft;
  };

  for (const item of items) {
    if (item.type === 'thinking') {
      const hint = cleanInline(item.thought.subject || item.thought.description);
      currentBranch = createDraft(hint);
      continue;
    }

    if (item.type !== 'tool_group') {
      continue;
    }

    const seenRootIds = new Set<string>();
    for (const tool of item.tools) {
      const rootId = rootIdByDescendantId.get(tool.callId);
      if (!rootId || assignedRootIds.has(rootId) || seenRootIds.has(rootId)) {
        continue;
      }

      seenRootIds.add(rootId);
      assignedRootIds.add(rootId);

      if (currentBranch) {
        currentBranch.rootIds.push(rootId);
        continue;
      }

      const rootNode = rootNodeById.get(rootId);
      const heuristicKey = rootNode ? deriveHeuristicBranchKey([rootNode]) : 'default';
      const lastDraft = drafts.at(-1);
      const heuristicDraft =
        lastDraft &&
        !lastDraft.hint &&
        lastDraft.heuristicKey === heuristicKey
          ? lastDraft
          : createDraft(undefined, heuristicKey);

      heuristicDraft.rootIds.push(rootId);
    }
  }

  const unassignedRoots = rootNodes.filter((node) => !assignedRootIds.has(node.id));
  for (const rootNode of unassignedRoots) {
    const heuristicKey = deriveHeuristicBranchKey([rootNode]);
    const lastDraft = drafts.at(-1);
    const heuristicDraft =
      lastDraft && !lastDraft.hint && lastDraft.heuristicKey === heuristicKey
        ? lastDraft
        : createDraft(undefined, heuristicKey);
    heuristicDraft.rootIds.push(rootNode.id);
  }

  return drafts;
}

export function buildPresentationTraceTree(
  rootNodes: TraceNode[],
  items: Array<HistoryItem | HistoryItemWithoutId>,
  taskLabel: string | undefined,
  isTraceActive: boolean,
): TraceNode[] {
  if (rootNodes.length === 0) {
    return [];
  }

  const rootNodeById = new Map(rootNodes.map((node) => [node.id, node]));
  const branchDrafts = buildBranchDrafts(rootNodes, items);
  const visibleDrafts = branchDrafts.filter(
    (draft, index) =>
      draft.rootIds.length > 0 ||
      (index === branchDrafts.length - 1 && isTraceActive),
  );

  const branchLabelOccurrences = new Map<string, number>();
  const branchNodes = visibleDrafts.map((draft, index) => {
    const rawBranchRoots = draft.rootIds
      .map((rootId) => rootNodeById.get(rootId))
      .filter((node): node is TraceNode => node !== undefined);
    const clonedChildren = rawBranchRoots.map((node) =>
      cloneToolSubtree(node, draft.id),
    );

    const isLatestBranch = index === visibleDrafts.length - 1;
    const shouldShowPendingChild =
      isLatestBranch && isTraceActive && clonedChildren.length === 0;

    const branchChildren = shouldShowPendingChild
      ? [...clonedChildren, createPendingNode(draft.id)]
      : clonedChildren;

    const branchHasActiveDescendant = hasActiveDescendant(branchChildren);
    const branchHasFailure = hasFailure(branchChildren);
    const baseLabel = finalizeBranchLabel(draft.hint, rawBranchRoots);
    const occurrence = (branchLabelOccurrences.get(baseLabel) ?? 0) + 1;
    branchLabelOccurrences.set(baseLabel, occurrence);

    return {
      id: draft.id,
      parentId: TRACE_TASK_ROOT_ID,
      type: 'decision' as const,
      name: occurrence > 1 ? `${baseLabel} (${occurrence})` : baseLabel,
      status: deriveAggregateTraceStatus(
        branchChildren,
        Boolean(isLatestBranch && isTraceActive && !branchHasActiveDescendant),
      ),
      isConfirming: branchChildren.some((child) => child.isConfirming),
      hasFailedDescendant: branchHasFailure,
      children: branchChildren,
    };
  });

  return [
    {
      id: TRACE_TASK_ROOT_ID,
      type: 'task',
      name: taskLabel ?? 'Current task',
      status: deriveAggregateTraceStatus(branchNodes, isTraceActive),
      isConfirming: branchNodes.some((branch) => branch.isConfirming),
      hasFailedDescendant: branchNodes.some(
        (branch) =>
          branch.status === CoreToolCallStatus.Error || branch.hasFailedDescendant,
      ),
      children: branchNodes,
    },
  ];
}
