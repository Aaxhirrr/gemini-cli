/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { ApprovalMode, CoreToolCallStatus, Kind } from '@google/gemini-cli-core';
import { renderWithProviders } from '../../../test-utils/render.js';
import type { TraceNode } from '../../state/useTraceTree.js';
import { TraceNodeDetails } from './TraceNodeDetails.js';

const node: TraceNode = {
  id: 'read_file_1',
  type: 'tool',
  name: 'ReadFile',
  inputPreview: 'packages\\cli\\src\\config\\settingsSchema.ts',
  resultDisplay:
    'Read lines 1-2000 of 2775 from packages/cli/src/config/settingsSchema.ts',
  status: CoreToolCallStatus.Success,
  durationMs: 44,
  kind: Kind.Search,
  approvalMode: ApprovalMode.DEFAULT,
  schedulerId: 'root',
  children: [],
};

describe('TraceNodeDetails', () => {
  it('renders compact section text in panel layout with actionable hidden-line hints', async () => {
    const { lastFrame, unmount, waitUntilReady } = renderWithProviders(
      <TraceNodeDetails
        node={node}
        isSelected={true}
        isExpanded={true}
        indent={0}
        toggleHint="Enter"
        layout="panel"
        panelMode="compact"
        sectionMaxLines={2}
        showMoreHint="Ctrl+O"
      />,
      {
        useAlternateBuffer: false,
        width: 100,
      },
    );

    await waitUntilReady();

    const frame = lastFrame();
    expect(frame).toContain('Input');
    expect(frame).toContain('packages\\cli\\src\\config\\settingsSchema.ts');
    expect(frame).toContain('Output');
    expect(frame).toContain('Read lines 1-2000 of 2775');
    expect(frame).toContain('Metadata');
    expect(frame).toContain('Status: Success');
    expect(frame).toContain('... 4 more lines hidden (Ctrl+O to show more) ...');
    expect(frame).toContain('[Ctrl+O to show more inspector details]');
    expect(frame).toContain('[Enter to hide inspector]');

    unmount();
  });

  it('shows deeper metadata when the panel inspector is expanded', async () => {
    const { lastFrame, unmount, waitUntilReady } = renderWithProviders(
      <TraceNodeDetails
        node={node}
        isSelected={true}
        isExpanded={true}
        indent={0}
        toggleHint="Enter"
        layout="panel"
        panelMode="expanded"
        sectionMaxLines={2}
        showMoreHint="Ctrl+O"
      />,
      {
        useAlternateBuffer: false,
        width: 100,
      },
    );

    await waitUntilReady();

    const frame = lastFrame();
    expect(frame).toContain('Kind: search');
    expect(frame).toContain('Approval Mode: default');
    expect(frame).toContain('Scheduler: root');
    expect(frame).toContain('Call ID: read_file_1');
    expect(frame).toContain('[Enter to hide inspector]');

    unmount();
  });
});