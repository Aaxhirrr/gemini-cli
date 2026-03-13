/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreToolCallStatus } from '@google/gemini-cli-core';
import type { TraceNode } from '../../state/useTraceTree.js';

export type TraceVerbosityMode = 'quiet' | 'standard' | 'verbose' | 'debug';

const TRACE_VERBOSITY_MODES: ReadonlySet<string> = new Set([
  'quiet',
  'standard',
  'verbose',
  'debug',
]);

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

function collectQuietNodes(nodes: TraceNode[]): TraceNode[] {
  const finalNodes: TraceNode[] = [];

  for (const node of nodes) {
    if (isFinalStatus(node.status)) {
      finalNodes.push({
        ...node,
        parentId: undefined,
        children: [],
      });
    }

    if (node.children.length > 0) {
      finalNodes.push(...collectQuietNodes(node.children));
    }
  }

  return finalNodes;
}

function filterStandardNodes(
  nodes: TraceNode[],
  depth = 0,
): TraceNode[] {
  const filtered: TraceNode[] = [];

  for (const node of nodes) {
    const filteredChildren = filterStandardNodes(node.children, depth + 1);
    const keepSelf = shouldKeepNodeInStandardMode(node, depth);

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

export function filterTraceByVerbosity(
  nodes: TraceNode[],
  verbosity: TraceVerbosityMode,
): TraceNode[] {
  if (verbosity === 'quiet') {
    return collectQuietNodes(nodes);
  }

  if (verbosity === 'verbose' || verbosity === 'debug') {
    return nodes;
  }

  return filterStandardNodes(nodes);
}
