/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { describe, it, expect, vi, type Mock } from 'vitest';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { useKeypress } from '../../hooks/useKeypress.js';
import { StepActionBar } from './StepActionBar.js';
import type { TraceNode } from '../../state/useTraceTree.js';

vi.mock('../../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));

const mockedUseKeypress = useKeypress as Mock;

const pendingNode: TraceNode = {
  id: 'pending-node',
  type: 'tool',
  name: 'read_file',
  status: CoreToolCallStatus.AwaitingApproval,
  children: [],
};

describe('StepActionBar', () => {
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
});
