/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { useKeypress } from '../../hooks/useKeypress.js';
import { useMouseClick } from '../../hooks/useMouseClick.js';
import { StepActionBar } from './StepActionBar.js';
import type { TraceNode } from '../../state/useTraceTree.js';

vi.mock('../../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));

vi.mock('../../hooks/useMouseClick.js', () => ({
  useMouseClick: vi.fn(),
}));

const mockedUseKeypress = useKeypress as Mock;
const mockedUseMouseClick = useMouseClick as Mock;

const pendingNode: TraceNode = {
  id: 'pending-node',
  type: 'tool',
  name: 'read_file',
  status: CoreToolCallStatus.AwaitingApproval,
  children: [],
};

describe('StepActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles Enter for execute', async () => {
    const onExecute = vi.fn();
    const { waitUntilReady, unmount } = render(
      <StepActionBar
        pendingNode={pendingNode}
        isActive={true}
        onExecute={onExecute}
        onSkip={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await waitUntilReady();

    const handler = mockedUseKeypress.mock.calls[0][0] as (key: {
      name: string;
    }) => boolean | void;
    handler({ name: 'enter' });

    expect(onExecute).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('registers at critical keypress priority so step mode wins Enter before the trace tree', async () => {
    const { waitUntilReady, unmount } = render(
      <StepActionBar
        pendingNode={pendingNode}
        isActive={true}
        onExecute={vi.fn()}
        onSkip={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await waitUntilReady();

    const options = mockedUseKeypress.mock.calls[0][1] as { priority: number };
    expect(options.priority).toBe(200);

    unmount();
  });

  it('handles mouse click for execute', async () => {
    const onExecute = vi.fn();
    const { waitUntilReady, unmount } = render(
      <StepActionBar
        pendingNode={pendingNode}
        isActive={true}
        onExecute={onExecute}
        onSkip={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await waitUntilReady();

    const clickHandler = mockedUseMouseClick.mock.calls[0][1] as (
      event: unknown,
      relativeX: number,
      relativeY: number,
    ) => void;
    clickHandler({}, 0, 0);

    expect(onExecute).toHaveBeenCalledTimes(1);

    unmount();
  });
});
