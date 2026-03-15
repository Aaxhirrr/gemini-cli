/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { act } from 'react';
import { Text } from 'ink';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { TraceTree } from './TraceTree.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import type { TraceNode } from '../../state/useTraceTree.js';

const mocks = vi.hoisted(() => ({
  lastRowProps: null as {
    isSelected: boolean;
    isDetailsExpanded: boolean;
    showDetailsInline: boolean;
  } | null,
  renderedNodeIds: [] as string[],
}));

vi.mock('../../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));

vi.mock('./TraceNodeRow.js', () => ({
  TraceNodeRow: (props: {
    isSelected: boolean;
    isDetailsExpanded: boolean;
    showDetailsInline: boolean;
    node: TraceNode;
  }) => {
    mocks.lastRowProps = props;
    mocks.renderedNodeIds.push(props.node.id);
    return <Text>{props.node.id}</Text>;
  },
}));

vi.mock('./TraceNodeDetails.js', () => ({
  TraceNodeDetails: (props: {
    node: TraceNode;
    panelMode?: 'compact' | 'expanded';
  }) => (
    <Text>{`TraceNodeDetails:${props.node.id}:${props.panelMode ?? 'inline'}`}</Text>
  ),
}));

const mockedUseKeypress = useKeypress as Mock;

const rootNodes: TraceNode[] = [
  {
    id: 'tool-1',
    type: 'tool',
    name: 'shell_command',
    description: 'echo hello',
    status: CoreToolCallStatus.Executing,
    resultDisplay: 'hello',
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

  it('activates key capture while focused so paging and inspector toggles work', async () => {
    const { waitUntilReady, unmount } = render(
      <TraceTree rootNodes={rootNodes} isActive={false} isFocused={true} />,
    );

    await waitUntilReady();

    const options = mockedUseKeypress.mock.calls[0][1] as {
      isActive: boolean;
    };
    expect(options.isActive).toBe(true);

    unmount();
  });

  it('keeps a visible selection even when full navigation is inactive', async () => {
    const { waitUntilReady, unmount } = render(
      <TraceTree rootNodes={rootNodes} isActive={false} isFocused={true} />,
    );

    await waitUntilReady();

    expect(mocks.lastRowProps?.isSelected).toBe(true);

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

  it('handles Enter for node selection when there are no details to inspect', async () => {
    const onNodeSelect = vi.fn();
    const plainNode: TraceNode[] = [
      {
        id: 'decision-node',
        type: 'decision',
        name: 'Inspect source files',
        status: CoreToolCallStatus.Success,
        children: [],
      },
    ];
    const { waitUntilReady, unmount } = render(
      <TraceTree
        rootNodes={plainNode}
        isActive={true}
        isFocused={true}
        onNodeSelect={onNodeSelect}
      />,
    );

    await waitUntilReady();

    const handler = mockedUseKeypress.mock.calls[0][0] as (key: {
      name: string;
      ctrl?: boolean;
    }) => boolean | void;
    handler({ name: 'enter' });

    expect(onNodeSelect).toHaveBeenCalledWith(plainNode[0]);

    unmount();
  });

  it('toggles details with Ctrl+O even when the tree is read-only', async () => {
    const { waitUntilReady, unmount } = render(
      <TraceTree rootNodes={rootNodes} isActive={false} isFocused={true} />,
    );

    await waitUntilReady();

    const handler = mockedUseKeypress.mock.calls[0][0] as (key: {
      name: string;
      ctrl?: boolean;
    }) => boolean | void;

    await act(async () => {
      handler({ name: 'o', ctrl: true });
    });
    await waitUntilReady();

    expect(mocks.lastRowProps?.isDetailsExpanded).toBe(true);

    unmount();
  });

  it('treats Enter as node selection when details are disabled', async () => {
    const onNodeSelect = vi.fn();
    const { waitUntilReady, unmount } = render(
      <TraceTree
        rootNodes={rootNodes}
        isActive={true}
        isFocused={true}
        detailView="off"
        onNodeSelect={onNodeSelect}
      />,
    );

    await waitUntilReady();

    const handler = mockedUseKeypress.mock.calls[0][0] as (key: {
      name: string;
      ctrl?: boolean;
    }) => boolean | void;

    handler({ name: 'enter' });

    expect(onNodeSelect).toHaveBeenCalledWith(rootNodes[0]);
    expect(mocks.lastRowProps?.isDetailsExpanded).toBe(false);

    unmount();
  });

  it('uses a separate inspector panel in panel mode instead of expanding rows inline', async () => {
    const { lastFrame, waitUntilReady, unmount } = render(
      <TraceTree
        rootNodes={rootNodes}
        isActive={true}
        isFocused={true}
        detailView="panel"
      />,
    );

    await waitUntilReady();

    expect(mocks.lastRowProps?.showDetailsInline).toBe(false);

    const handler = mockedUseKeypress.mock.calls[0][0] as (key: {
      name: string;
      ctrl?: boolean;
    }) => boolean | void;

    await act(async () => {
      handler({ name: 'enter' });
    });
    await waitUntilReady();

    expect(lastFrame()).toContain('Inspector');
    expect(lastFrame()).toContain('TraceNodeDetails:tool-1:compact');
    expect(mocks.lastRowProps?.isDetailsExpanded).toBe(true);

    unmount();
  });

  it('toggles expanded inspector detail mode with Ctrl+O in panel mode', async () => {
    const { lastFrame, waitUntilReady, unmount } = render(
      <TraceTree
        rootNodes={rootNodes}
        isActive={true}
        isFocused={true}
        detailView="panel"
      />,
    );

    await waitUntilReady();

    const handler = mockedUseKeypress.mock.calls[0][0] as (key: {
      name: string;
      ctrl?: boolean;
    }) => boolean | void;

    await act(async () => {
      handler({ name: 'enter' });
    });
    await waitUntilReady();
    expect(lastFrame()).toContain('TraceNodeDetails:tool-1:compact');

    await act(async () => {
      handler({ name: 'o', ctrl: true });
    });
    await waitUntilReady();
    expect(lastFrame()).toContain('TraceNodeDetails:tool-1:expanded');

    await act(async () => {
      handler({ name: 'o', ctrl: true });
    });
    await waitUntilReady();
    expect(lastFrame()).toContain('TraceNodeDetails:tool-1:compact');

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
      <TraceTree
        rootNodes={nestedRootNodes}
        isActive={false}
        isFocused={true}
      />,
    );

    await waitUntilReady();

    expect(new Set(mocks.renderedNodeIds)).toEqual(
      new Set(['root-tool', 'child-tool']),
    );

    unmount();
  });

  it('shows keyboard viewport affordances when the tree has more rows than fit', async () => {
    const manyRootNodes: TraceNode[] = Array.from(
      { length: 20 },
      (_, index) => ({
        id: `tool-${index + 1}`,
        type: 'tool',
        name: `tool-${index + 1}`,
        status: CoreToolCallStatus.Success,
        children: [],
      }),
    );

    const { lastFrame, waitUntilReady, unmount } = render(
      <TraceTree rootNodes={manyRootNodes} isActive={true} isFocused={true} />,
    );

    await waitUntilReady();

    expect(lastFrame()).toContain('[PgDn] 5 more below');

    unmount();
  });

  it('supports page-down scrolling even when the tree is read-only', async () => {
    const manyRootNodes: TraceNode[] = Array.from(
      { length: 20 },
      (_, index) => ({
        id: `tool-${index + 1}`,
        type: 'tool',
        name: `tool-${index + 1}`,
        status: CoreToolCallStatus.Success,
        children: [],
      }),
    );

    const { lastFrame, waitUntilReady, unmount } = render(
      <TraceTree rootNodes={manyRootNodes} isActive={false} isFocused={true} />,
    );

    await waitUntilReady();

    const handler = mockedUseKeypress.mock.calls[0][0] as (key: {
      name: string;
      ctrl?: boolean;
    }) => boolean | void;

    expect(lastFrame()).toContain('[PgDn] 5 more below');

    await act(async () => {
      handler({ name: 'pagedown' });
    });
    await waitUntilReady();

    expect(lastFrame()).toContain('[PgUp] 4 more above');
    expect(lastFrame()).toContain('tool-19');

    unmount();
  });
});
