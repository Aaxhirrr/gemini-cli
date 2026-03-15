/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreToolCallStatus } from '@google/gemini-cli-core';
import type { TraceNode } from '../../state/useTraceTree.js';

export type TraceVerbosityMode = 'quiet' | 'standard' | 'verbose' | 'debug';
export type TraceVerbosityOverrideMode = TraceVerbosityMode | 'inherit';
export type TraceVerbosityCategory = TraceNode['type'];
export type TraceCategoryVerbosityOverrides = Partial<
  Record<TraceVerbosityCategory, TraceVerbosityOverrideMode | undefined>
>;
export type ResolvedTraceCategoryVerbosity = Partial<
  Record<TraceVerbosityCategory, TraceVerbosityMode>
>;

const TRACE_VERBOSITY_MODES: ReadonlySet<string> = new Set([
  'quiet',
  'standard',
  'verbose',
  'debug',
]);
const TRACE_VERBOSITY_CATEGORIES: readonly TraceVerbosityCategory[] = [
  'task',
  'decision',
  'subagent',
  'tool',
];

function isFinalStatus(status: CoreToolCallStatus): boolean {
  return (
    status === CoreToolCallStatus.Success ||
    status === CoreToolCallStatus.Error ||
    status === CoreToolCallStatus.Cancelled
  );
}

function isActiveStatus(status: CoreToolCallStatus): boolean {
  return (
    status === CoreToolCallStatus.Scheduled ||
    status === CoreToolCallStatus.Validating ||
    status === CoreToolCallStatus.Executing ||
    status === CoreToolCallStatus.AwaitingApproval
  );
}

function shouldKeepNodeInStandardMode(node: TraceNode, depth: number): boolean {
  if (node.type !== 'tool') {
    return true;
  }

  if (isActiveStatus(node.status)) {
    return true;
  }

  if (
    node.status === CoreToolCallStatus.Error ||
    node.status === CoreToolCallStatus.Cancelled
  ) {
    return true;
  }

  if ((node.retryCount ?? 0) > 1) {
    return true;
  }

  if (node.hasFailedDescendant) {
    return true;
  }

  // Keep the first few completed tool levels so the tree remains readable.
  return depth <= 3 && isFinalStatus(node.status);
}

function shouldKeepNodeInQuietMode(node: TraceNode, depth: number): boolean {
  if (node.type === 'task') {
    return true;
  }

  if (node.type !== 'tool') {
    if (node.isConfirming) {
      return true;
    }

    if (isActiveStatus(node.status)) {
      return true;
    }

    if (
      node.status === CoreToolCallStatus.Error ||
      node.status === CoreToolCallStatus.Cancelled
    ) {
      return true;
    }

    if ((node.retryCount ?? 0) > 1) {
      return true;
    }

    if (node.hasFailedDescendant) {
      return true;
    }

    // Quiet mode keeps the root task and its immediate structural branches,
    // while deeper successful reasoning scaffolding stays hidden unless it is
    // active or part of a failure/waiting path.
    return depth <= 1;
  }

  if (node.isConfirming) {
    return true;
  }

  if (isActiveStatus(node.status)) {
    return true;
  }

  if (
    node.status === CoreToolCallStatus.Error ||
    node.status === CoreToolCallStatus.Cancelled
  ) {
    return true;
  }

  if ((node.retryCount ?? 0) > 1) {
    return true;
  }

  if (node.hasFailedDescendant) {
    return true;
  }

  return depth === 0 && isFinalStatus(node.status);
}

function stripQuietDuplicateSuffix(name: string): string {
  return name.replace(/\s+\(\d+\)$/u, '');
}

function isQuietMergeableStructuralNode(node: TraceNode): boolean {
  return (
    node.type !== 'tool' &&
    node.status === CoreToolCallStatus.Success &&
    !node.isConfirming &&
    !node.hasFailedDescendant &&
    node.children.length === 0
  );
}

function collapseQuietStructuralSiblings(nodes: TraceNode[]): TraceNode[] {
  const collapsed: TraceNode[] = [];
  const mergedKeys = new Set<string>();

  for (const node of nodes) {
    const collapsedChildren = collapseQuietStructuralSiblings(node.children);
    const nextNode: TraceNode = {
      ...node,
      children: collapsedChildren,
    };

    if (!isQuietMergeableStructuralNode(nextNode)) {
      collapsed.push(nextNode);
      continue;
    }

    const normalizedName = stripQuietDuplicateSuffix(nextNode.name);
    const mergeKey = `${nextNode.type}:${normalizedName}`;

    if (mergedKeys.has(mergeKey)) {
      continue;
    }

    mergedKeys.add(mergeKey);
    collapsed.push({
      ...nextNode,
      name: normalizedName,
    });
  }

  return collapsed;
}

export function isTraceVerbosityMode(
  value: string | undefined,
): value is TraceVerbosityMode {
  return !!value && TRACE_VERBOSITY_MODES.has(value);
}

export function resolveTraceVerbosity(
  envValue: string | undefined,
  settingsValue: string | undefined,
): TraceVerbosityMode {
  if (isTraceVerbosityMode(envValue)) {
    return envValue;
  }
  if (isTraceVerbosityMode(settingsValue)) {
    return settingsValue;
  }
  return 'quiet';
}

export function resolveTraceCategoryVerbosity(
  overrides: TraceCategoryVerbosityOverrides | undefined,
): ResolvedTraceCategoryVerbosity {
  const resolved: ResolvedTraceCategoryVerbosity = {};
  if (!overrides) {
    return resolved;
  }

  for (const category of TRACE_VERBOSITY_CATEGORIES) {
    const value = overrides[category];
    if (isTraceVerbosityMode(value)) {
      resolved[category] = value;
    }
  }

  return resolved;
}

export function resolveNodeTraceVerbosity(
  nodeType: TraceVerbosityCategory,
  verbosity: TraceVerbosityMode,
  categoryVerbosity?: ResolvedTraceCategoryVerbosity,
): TraceVerbosityMode {
  return categoryVerbosity?.[nodeType] ?? verbosity;
}

export function shouldRenderTraceForVerbosity(
  _verbosity: TraceVerbosityMode,
  _categoryVerbosity?: ResolvedTraceCategoryVerbosity,
): boolean {
  return true;
}

function hasCategoryVerbosityOverrides(
  categoryVerbosity?: ResolvedTraceCategoryVerbosity,
): boolean {
  return Object.keys(categoryVerbosity ?? {}).length > 0;
}

function filterTraceByCategoryVerbosity(
  nodes: TraceNode[],
  verbosity: TraceVerbosityMode,
  categoryVerbosity: ResolvedTraceCategoryVerbosity | undefined,
  depth = 0,
): TraceNode[] {
  const filtered: TraceNode[] = [];

  for (const node of nodes) {
    const filteredChildren = filterTraceByCategoryVerbosity(
      node.children,
      verbosity,
      categoryVerbosity,
      depth + 1,
    );
    const effectiveVerbosity = resolveNodeTraceVerbosity(
      node.type,
      verbosity,
      categoryVerbosity,
    );

    let keepSelf = false;
    if (effectiveVerbosity === 'verbose' || effectiveVerbosity === 'debug') {
      keepSelf = true;
    } else if (effectiveVerbosity === 'standard') {
      keepSelf = shouldKeepNodeInStandardMode(node, depth);
    } else {
      keepSelf = shouldKeepNodeInQuietMode(node, depth);
    }

    if (!keepSelf && filteredChildren.length === 0) {
      continue;
    }

    filtered.push({
      ...node,
      children: filteredChildren,
    });
  }

  return filtered;
}

export function filterTraceByVerbosity(
  nodes: TraceNode[],
  verbosity: TraceVerbosityMode,
  categoryVerbosity?: ResolvedTraceCategoryVerbosity,
): TraceNode[] {
  if (
    (verbosity === 'verbose' || verbosity === 'debug') &&
    !hasCategoryVerbosityOverrides(categoryVerbosity)
  ) {
    return nodes;
  }

  const filtered = filterTraceByCategoryVerbosity(
    nodes,
    verbosity,
    categoryVerbosity,
  );

  if (verbosity === 'quiet') {
    return collapseQuietStructuralSiblings(filtered);
  }

  return filtered;
}
