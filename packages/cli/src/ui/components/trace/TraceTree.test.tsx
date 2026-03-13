/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Text } from 'ink';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { TraceTree } from './TraceTree.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import type { TraceNode } from '../../state/useTraceTree.js';

const mocks = vi.hoisted(() => ({
  lastRowProps: null as { isSelected: boolean } | null,
  renderedNodeIds: [] as string[],
}));

vi.mock('../../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));

vi.mock('./TraceNodeRow.js', () => ({
  TraceNodeRow: (props: { isSelected: boolean; node: TraceNode }) => {
    mocks.lastRowProps = props;
    mocks.renderedNodeIds.push(props.node.id);
    return <Text>{props.node.id}</Text>;
  },
}));

const mockedUseKeypress = useKeypress as Mock;

const rootNodes: TraceNode[] = [
  {
    id: 'tool-1',
    type: 'tool',
    name: 'shell_command',
    status: CoreToolCallStatus.Executing,
    children: [],
  },
];

describe('TraceTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lastRowProps = null;
    mocks.renderedNodeIds = [];
  });

  it('does not activate key capture when not focused', async () => {
    const { waitUntilReady, unmount } = render(
      <TraceTree rootNodes={rootNodes} isActive={true} isFocused={false} />,
    );

    await waitUntilReady();

    const options = mockedUseKeypress.mock.calls[0][1] as {
      isActive: boolean;
    };
    expect(options.isActive).toBe(false);

    unmount();
  });

  it('activates key capture only when active and focused', async () => {
    const { waitUntilReady, unmount } = render(
      <TraceTree rootNodes={rootNodes} isActive={true} isFocused={true} />,
    );

    await waitUntilReady();

    const options = mockedUseKeypress.mock.calls[0][1] as {
      isActive: boolean;
    };
    expect(options.isActive).toBe(true);

    unmount();
  });

  it('does not show a selected row when navigation is inactive', async () => {
    const { waitUntilReady, unmount } = render(
      <TraceTree rootNodes={rootNodes} isActive={false} isFocused={true} />,
    );

    await waitUntilReady();

    expect(mocks.lastRowProps?.isSelected).toBe(false);

    unmount();
  });

  it('shows the selected row when navigation is interactive', async () => {
    const { waitUntilReady, unmount } = render(
      <TraceTree rootNodes={rootNodes} isActive={true} isFocused={true} />,
    );

    await waitUntilReady();

    expect(mocks.lastRowProps?.isSelected).toBe(true);

    unmount();
  });

  it('handles Enter for node selection', async () => {
    const onNodeSelect = vi.fn();
    const { waitUntilReady, unmount } = render(
      <TraceTree
        rootNodes={rootNodes}
        isActive={true}
        isFocused={true}
        onNodeSelect={onNodeSelect}
      />,
    );

    await waitUntilReady();

    const handler = mockedUseKeypress.mock.calls[0][0] as (key: {
      name: string;
    }) => boolean | void;
    handler({ name: 'enter' });

    expect(onNodeSelect).toHaveBeenCalledWith(rootNodes[0]);

    unmount();
  });

  it('auto-expands top-level structural nodes so read-only trees stay readable', async () => {
    const nestedRootNodes: TraceNode[] = [
      {
        id: 'root-tool',
        type: 'tool',
        name: 'delegate',
        status: CoreToolCallStatus.Success,
        children: [
          {
            id: 'child-tool',
            parentId: 'root-tool',
            type: 'tool',
            name: 'read_file',
            status: CoreToolCallStatus.Success,
            children: [],
          },
        ],
      },
    ];

    const { waitUntilReady, unmount } = render(
      <TraceTree rootNodes={nestedRootNodes} isActive={false} isFocused={true} />,
    );

    await waitUntilReady();

    expect(new Set(mocks.renderedNodeIds)).toEqual(
      new Set(['root-tool', 'child-tool']),
    );

    unmount();
  });

  it('shows keyboard viewport affordances when the tree has more rows than fit', async () => {
    const manyRootNodes: TraceNode[] = Array.from({ length: 20 }, (_, index) => ({
      id: `tool-${index + 1}`,
      type: 'tool',
      name: `tool-${index + 1}`,
      status: CoreToolCallStatus.Success,
      children: [],
    }));

    const { lastFrame, waitUntilReady, unmount } = render(
      <TraceTree rootNodes={manyRootNodes} isActive={true} isFocused={true} />,
    );

    await waitUntilReady();

    expect(lastFrame()).toContain('[PgDn] 5 more below');

    unmount();
  });
});
