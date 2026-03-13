/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import type { HistoryItem } from '../../types.js';
import type { TraceNode } from '../../state/useTraceTree.js';
import { buildPresentationTraceTree } from './presentationTree.js';

function makeToolNode(
  id: string,
  overrides: Partial<TraceNode> = {},
): TraceNode {
  return {
    id,
    type: 'tool',
    name: 'read_file',
    description: 'packages/cli/src/config/config.ts',
    status: CoreToolCallStatus.Success,
    children: [],
    ...overrides,
  };
}

describe('presentationTree', () => {
  it('groups config-tracing work into meaningful branches and keeps a pending summary branch visible', () => {
    const rootNodes: TraceNode[] = [
      makeToolNode('search-entrypoints', {
        name: 'search_text',
        description: "'(config|settings|loadConfig)' within ./",
      }),
      makeToolNode('read-cli-root', {
        name: 'ls',
        description: 'packages/cli/src',
      }),
      makeToolNode('read-core-root', {
        name: 'ls',
        description: 'packages/core/src',
      }),
      makeToolNode('cli-entrypoint', {
        name: 'read_file',
        description: 'packages/cli/src/gemini.tsx',
      }),
      makeToolNode('cli-config-search', {
        name: 'search_text',
        description: "'loadCliConfig|loadSettings' within packages/cli/src",
      }),
      makeToolNode('settings-file', {
        name: 'read_file',
        description: 'packages/cli/src/config/settings.ts',
      }),
      makeToolNode('settings-search', {
        name: 'search_text',
        description: "'export function loadSettings' within packages/cli/src/config",
      }),
      makeToolNode('core-config-file', {
        name: 'read_file',
        description: 'packages/core/src/config/config.ts',
      }),
      makeToolNode('core-config-params', {
        name: 'search_text',
        description: "'ConfigParameters' within packages/core/src/config",
      }),
      makeToolNode('core-config-class', {
        name: 'search_text',
        description: "'export class Config' within packages/core/src/config",
        status: CoreToolCallStatus.Error,
        errorName: 'regex parse error',
        errorMessage: 'unclosed counted repetition',
      }),
    ];

    const items: HistoryItem[] = [
      {
        id: 1,
        type: 'thinking',
        thought: {
          subject: 'I will discover config entrypoints',
          description: '',
        },
      },
      {
        id: 2,
        type: 'tool_group',
        tools: [
          { callId: 'search-entrypoints' },
          { callId: 'read-cli-root' },
          { callId: 'read-core-root' },
        ],
      } as HistoryItem,
      {
        id: 3,
        type: 'thinking',
        thought: {
          subject: 'I will trace CLI initialization',
          description: '',
        },
      },
      {
        id: 4,
        type: 'tool_group',
        tools: [
          { callId: 'cli-entrypoint' },
          { callId: 'cli-config-search' },
        ],
      } as HistoryItem,
      {
        id: 5,
        type: 'thinking',
        thought: {
          subject: 'I will trace settings merge flow',
          description: '',
        },
      },
      {
        id: 6,
        type: 'tool_group',
        tools: [{ callId: 'settings-file' }, { callId: 'settings-search' }],
      } as HistoryItem,
      {
        id: 7,
        type: 'thinking',
        thought: {
          subject: 'I will trace core Config lifecycle',
          description: '',
        },
      },
      {
        id: 8,
        type: 'tool_group',
        tools: [
          { callId: 'core-config-file' },
          { callId: 'core-config-params' },
          { callId: 'core-config-class' },
        ],
      } as HistoryItem,
      {
        id: 9,
        type: 'thinking',
        thought: {
          subject: 'I will summarize architecture',
          description: '',
        },
      },
    ];

    const tree = buildPresentationTraceTree(
      rootNodes,
      items,
      'Analyze configuration loading across repo',
      true,
    );

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Analyze configuration loading across repo');
    expect(tree[0].children.map((child) => child.name)).toEqual([
      'Discover config entrypoints',
      'Trace CLI initialization',
      'Trace settings merge flow',
      'Trace core Config lifecycle',
      'Summarize architecture',
    ]);
    expect(tree[0].children[0]?.children.map((child) => child.name)).toEqual([
      'SearchText',
      'ReadFolder',
      'ReadFolder',
    ]);
    expect(tree[0].children[1]?.children.map((child) => child.name)).toEqual([
      'ReadFile',
      'SearchText',
    ]);
    expect(tree[0].children[3]?.status).toBe(CoreToolCallStatus.Error);
    expect(tree[0].children[3]?.children[2]?.errorMessage).toBe(
      'unclosed counted repetition',
    );
    expect(tree[0].children[4]?.children[0]?.name).toBe('pending');
  });
});
