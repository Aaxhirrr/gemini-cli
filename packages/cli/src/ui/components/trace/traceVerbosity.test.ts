/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import type { TraceNode } from '../../state/useTraceTree.js';
import {
  filterTraceByVerbosity,
  resolveNodeTraceVerbosity,
  resolveTraceCategoryVerbosity,
  resolveTraceVerbosity,
  shouldRenderTraceForVerbosity,
} from './traceVerbosity.js';

function makeNode(
  id: string,
  status: CoreToolCallStatus,
  children: TraceNode[] = [],
): TraceNode {
  return {
    id,
    type: 'tool',
    name: id,
    status,
    children,
  };
}

describe('traceVerbosity', () => {
  it('resolves env override first, then settings, then default', () => {
    expect(resolveTraceVerbosity('debug', 'quiet')).toBe('debug');
    expect(resolveTraceVerbosity(undefined, 'verbose')).toBe('verbose');
    expect(resolveTraceVerbosity(undefined, undefined)).toBe('quiet');
    expect(resolveTraceVerbosity('invalid', 'quiet')).toBe('quiet');
  });

  it('keeps a compact tree in quiet mode while suppressing successful tool noise', () => {
    const tree = [
      {
        id: 'task',
        type: 'task',
        name: 'Task',
        status: CoreToolCallStatus.Success,
        children: [
          {
            id: 'decision',
            type: 'decision',
            name: 'Inspect files',
            status: CoreToolCallStatus.Success,
            children: [makeNode('tool-success', CoreToolCallStatus.Success)],
          },
        ],
      } satisfies TraceNode,
      makeNode('root-running', CoreToolCallStatus.Executing),
    ];

    const filtered = filterTraceByVerbosity(tree, 'quiet');
    expect(filtered.map((node) => node.id)).toEqual(['task', 'root-running']);
    expect(filtered[0].children).toHaveLength(1);
    expect(filtered[0].children[0].id).toBe('decision');
    expect(filtered[0].children[0].children).toHaveLength(0);
  });

  it('collapses duplicate successful structural branches in quiet mode', () => {
    const tree = [
      {
        id: 'task',
        type: 'task',
        name: 'Task',
        status: CoreToolCallStatus.Success,
        children: [
          {
            id: 'decision-1',
            type: 'decision',
            name: 'Discover relevant files',
            status: CoreToolCallStatus.Success,
            children: [],
          } satisfies TraceNode,
          {
            id: 'decision-2',
            type: 'decision',
            name: 'Discover relevant files (2)',
            status: CoreToolCallStatus.Success,
            children: [],
          } satisfies TraceNode,
          {
            id: 'decision-3',
            type: 'decision',
            name: 'Trace CLI initialization',
            status: CoreToolCallStatus.Success,
            children: [],
          } satisfies TraceNode,
        ],
      } satisfies TraceNode,
    ];

    const filtered = filterTraceByVerbosity(tree, 'quiet');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].children.map((child) => child.name)).toEqual([
      'Discover relevant files',
      'Trace CLI initialization',
    ]);
  });

  it('keeps standard mode concise while preserving readable hierarchy', () => {
    const tree = [
      makeNode('root-success', CoreToolCallStatus.Success, [
        makeNode('leaf-success', CoreToolCallStatus.Success),
      ]),
      makeNode('root-running', CoreToolCallStatus.Executing),
      makeNode('root-error', CoreToolCallStatus.Error),
    ];

    const filtered = filterTraceByVerbosity(tree, 'standard');
    expect(filtered.map((node) => node.id)).toEqual([
      'root-success',
      'root-running',
      'root-error',
    ]);
    expect(filtered[0].children).toHaveLength(1);
    expect(filtered[0].children[0].id).toBe('leaf-success');
  });

  it('returns full tree for verbose and debug modes', () => {
    const tree = [makeNode('root', CoreToolCallStatus.Success)];
    expect(filterTraceByVerbosity(tree, 'verbose')).toBe(tree);
    expect(filterTraceByVerbosity(tree, 'debug')).toBe(tree);
  });

  it('resolves per-category overrides while ignoring inherit', () => {
    const resolved = resolveTraceCategoryVerbosity({
      task: 'inherit',
      decision: 'verbose',
      tool: 'debug',
    });

    expect(resolved).toEqual({
      decision: 'verbose',
      tool: 'debug',
    });
    expect(resolveNodeTraceVerbosity('task', 'standard', resolved)).toBe(
      'standard',
    );
    expect(resolveNodeTraceVerbosity('tool', 'standard', resolved)).toBe(
      'debug',
    );
  });

  it('renders the trace UI even in global quiet mode', () => {
    expect(shouldRenderTraceForVerbosity('quiet')).toBe(true);
    expect(
      shouldRenderTraceForVerbosity('quiet', {
        tool: 'verbose',
      }),
    ).toBe(true);
  });

  it('can suppress successful tool nodes while keeping structural nodes', () => {
    const tree = [
      {
        id: 'task',
        type: 'task',
        name: 'Task',
        status: CoreToolCallStatus.Success,
        children: [
          {
            id: 'decision',
            type: 'decision',
            name: 'Inspect files',
            status: CoreToolCallStatus.Success,
            children: [makeNode('tool-success', CoreToolCallStatus.Success)],
          },
        ],
      } satisfies TraceNode,
    ];

    const filtered = filterTraceByVerbosity(tree, 'standard', {
      tool: 'quiet',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].children).toHaveLength(1);
    expect(filtered[0].children[0].id).toBe('decision');
    expect(filtered[0].children[0].children).toHaveLength(0);
  });

  it('can promote a single category above a globally quiet trace', () => {
    const tree = [
      {
        id: 'task',
        type: 'task',
        name: 'Task',
        status: CoreToolCallStatus.Success,
        children: [makeNode('tool-success', CoreToolCallStatus.Success)],
      } satisfies TraceNode,
    ];

    const filtered = filterTraceByVerbosity(tree, 'quiet', {
      tool: 'verbose',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('task');
    expect(filtered[0].children).toHaveLength(1);
    expect(filtered[0].children[0].id).toBe('tool-success');
  });
});
