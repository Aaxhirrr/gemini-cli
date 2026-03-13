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
  resolveTraceVerbosity,
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

  it('filters quiet mode to final states', () => {
    const tree = [
      makeNode('root', CoreToolCallStatus.Executing, [
        makeNode('success', CoreToolCallStatus.Success),
        makeNode('running', CoreToolCallStatus.Executing),
      ]),
    ];

    const filtered = filterTraceByVerbosity(tree, 'quiet');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('success');
    expect(filtered[0].children).toHaveLength(0);
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
});
