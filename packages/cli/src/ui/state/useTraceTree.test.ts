/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook } from '../../test-utils/render.js';
import { waitFor } from '../../test-utils/async.js';
import { describe, it, expect } from 'vitest';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { useTraceTree } from './useTraceTree.js';
import type {
  HistoryItem,
  HistoryItemWithoutId,
  IndividualToolCallDisplay,
} from '../types.js';

function makeToolCall(
  callId: string,
  overrides: Partial<IndividualToolCallDisplay> = {},
): IndividualToolCallDisplay {
  return {
    callId,
    name: 'read_file',
    description: 'Read file',
    status: CoreToolCallStatus.Success,
    resultDisplay: undefined,
    confirmationDetails: undefined,
    ...overrides,
  };
}

describe('useTraceTree', () => {
  it('deduplicates parent-child edges when the same calls appear in history and pending', async () => {
    const parent = makeToolCall('parent-call', { name: 'parent_task' });
    const child = makeToolCall('child-call', {
      parentCallId: 'parent-call',
      name: 'nested_tool',
    });

    const history: HistoryItem[] = [
      {
        id: 1,
        type: 'tool_group',
        tools: [parent, child],
      },
    ];
    const pendingItems: HistoryItemWithoutId[] = [
      {
        type: 'tool_group',
        tools: [parent, child],
      },
    ];

    const { result } = renderHook(() => useTraceTree(history, pendingItems));

    await waitFor(() => expect(result.current.tree).toHaveLength(1));
    expect(result.current.tree[0].id).toBe('parent-call');
    expect(result.current.tree[0].children).toHaveLength(1);
    expect(result.current.tree[0].children[0].id).toBe('child-call');
  });

  it('prefers live tool-call state over committed history for the same call', async () => {
    const committed = makeToolCall('live-priority-call', {
      status: CoreToolCallStatus.Success,
    });
    const live = makeToolCall('live-priority-call', {
      status: CoreToolCallStatus.Executing,
    });

    const history: HistoryItem[] = [
      {
        id: 1,
        type: 'tool_group',
        tools: [committed],
      },
    ];

    const { result } = renderHook(() =>
      useTraceTree(history, [], [live]),
    );

    await waitFor(() => expect(result.current.tree).toHaveLength(1));
    expect(result.current.tree[0].status).toBe(CoreToolCallStatus.Executing);
  });

  it('creates a subagent container node for non-root scheduler calls', async () => {
    const rootTool = makeToolCall('root-tool', {
      name: 'delegate',
      schedulerId: 'root',
    });
    const subagentTool = makeToolCall('subagent-tool', {
      parentCallId: 'root-tool',
      schedulerId: 'agent-1',
      name: 'read_file',
    });
    const nestedInSubagent = makeToolCall('subagent-child-tool', {
      parentCallId: 'subagent-tool',
      schedulerId: 'agent-1',
      name: 'grep_search',
    });

    const history: HistoryItem[] = [
      {
        id: 1,
        type: 'tool_group',
        tools: [rootTool, subagentTool, nestedInSubagent],
      },
    ];

    const { result } = renderHook(() => useTraceTree(history, []));
    await waitFor(() => expect(result.current.tree).toHaveLength(1));

    const root = result.current.tree[0];
    expect(root.id).toBe('root-tool');
    expect(root.children).toHaveLength(1);
    expect(root.children[0].id).toBe('subagent:agent-1');
    expect(root.children[0].type).toBe('subagent');
    expect(root.children[0].children).toHaveLength(1);
    expect(root.children[0].children[0].id).toBe('subagent-tool');
    expect(root.children[0].children[0].children).toHaveLength(1);
    expect(root.children[0].children[0].children[0].id).toBe(
      'subagent-child-tool',
    );
  });

  it('tracks retry attempt index per parent and original request name', async () => {
    const firstAttempt = makeToolCall('read-file-1', {
      name: 'Read File',
      originalRequestName: 'read_file',
    });
    const secondAttempt = makeToolCall('read-file-2', {
      name: 'Read File',
      originalRequestName: 'read_file',
    });
    const thirdAttempt = makeToolCall('read-file-3', {
      name: 'Read File',
      originalRequestName: 'read_file',
    });

    const history: HistoryItem[] = [
      {
        id: 1,
        type: 'tool_group',
        tools: [firstAttempt, secondAttempt, thirdAttempt],
      },
    ];

    const { result } = renderHook(() => useTraceTree(history, []));
    await waitFor(() => expect(result.current.tree).toHaveLength(3));

    expect(result.current.tree[0].retryCount).toBeUndefined();
    expect(result.current.tree[1].retryCount).toBe(2);
    expect(result.current.tree[2].retryCount).toBe(3);
  });
});
