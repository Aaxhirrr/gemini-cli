/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../test-utils/render.js';
import { waitFor } from '../../test-utils/async.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Text } from 'ink';
import { act, useState } from 'react';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { MainContent } from './MainContent.js';
import type { UIState } from '../contexts/UIStateContext.js';
import type { IndividualToolCallDisplay } from '../types.js';
import type { TraceNode } from '../state/useTraceTree.js';
import * as traceTreeState from '../state/useTraceTree.js';
import { StreamingState } from '../types.js';
import { createMockSettings } from '../../test-utils/settings.js';

const mocks = vi.hoisted(() => ({
  traceTreeProps: null as
    | {
        isActive?: boolean;
        isFocused?: boolean;
        rootNodes: TraceNode[];
        verbosity?: string;
        detailView?: string;
      }
    | null,
  stepActionBarProps: null as { isActive?: boolean } | null,
  toolConfirmationQueueProps: null as { confirmingTool: unknown } | null,
}));

vi.mock('./trace/TraceTree.js', () => ({
  TraceTree: (props: {
    isActive?: boolean;
    isFocused?: boolean;
    rootNodes: TraceNode[];
    verbosity?: string;
    detailView?: string;
  }) => {
    mocks.traceTreeProps = props;
    return <Text>TraceTreeMock</Text>;
  },
}));

vi.mock('./trace/StepActionBar.js', () => ({
  StepActionBar: (props: { isActive?: boolean }) => {
    mocks.stepActionBarProps = props;
    return <Text>StepActionBarMock</Text>;
  },
}));

vi.mock('./ToolConfirmationQueue.js', () => ({
  ToolConfirmationQueue: (props: { confirmingTool: unknown }) => {
    mocks.toolConfirmationQueueProps = props;
    return <Text>ToolConfirmationQueueMock</Text>;
  },
}));

const toolCall: IndividualToolCallDisplay = {
  callId: 'focus-test-call',
  name: 'read_file',
  description: 'Read file',
  status: CoreToolCallStatus.AwaitingApproval,
  resultDisplay: undefined,
  confirmationDetails: undefined,
};

describe('MainContent trace focus behavior', () => {
  beforeEach(() => {
    mocks.traceTreeProps = null;
    mocks.stepActionBarProps = null;
    mocks.toolConfirmationQueueProps = null;
  });

  it('builds trace from current turn history only', async () => {
    const oldTurnTool: IndividualToolCallDisplay = {
      callId: 'old-turn-call',
      name: 'search_files',
      description: 'Old turn',
      status: CoreToolCallStatus.Success,
      resultDisplay: undefined,
      confirmationDetails: undefined,
    };

    const currentTurnTool: IndividualToolCallDisplay = {
      callId: 'current-turn-call',
      name: 'read_file',
      description: 'Current turn',
      status: CoreToolCallStatus.Success,
      resultDisplay: undefined,
      confirmationDetails: undefined,
    };

    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      uiState: {
        history: [
          { id: 1, type: 'user', text: 'first request' },
          { id: 2, type: 'tool_group', tools: [oldTurnTool] },
          { id: 3, type: 'user', text: 'second request' },
          { id: 4, type: 'tool_group', tools: [currentTurnTool] },
        ],
        pendingHistoryItems: [],
        stepMode: true,
        streamingState: StreamingState.Responding,
        isEditorDialogOpen: false,
        embeddedShellFocused: false,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(mocks.traceTreeProps?.rootNodes).toHaveLength(1);
    expect(mocks.traceTreeProps?.rootNodes[0]?.id).toBe('trace-task-root');
    expect(mocks.traceTreeProps?.rootNodes[0]?.children[0]?.type).toBe(
      'decision',
    );
    expect(mocks.traceTreeProps?.rootNodes[0]?.children[0]?.name).toBe(
      'Inspect source files',
    );
    expect(
      mocks.traceTreeProps?.rootNodes[0]?.children[0]?.children[0]?.id,
    ).toBe(
      'current-turn-call',
    );
    expect(mocks.traceTreeProps?.verbosity).toBe('standard');

    unmount();
  });

  it('keeps the latest trace visible after the turn completes and keeps tool rows out of the history log', async () => {
    const completedTool: IndividualToolCallDisplay = {
      callId: 'completed-turn-call',
      name: 'read_file',
      description: 'ShouldNotAppearInHistory',
      status: CoreToolCallStatus.Success,
      resultDisplay: 'completed output',
      confirmationDetails: undefined,
    };

    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'standard',
        },
      },
    });

    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      settings,
      uiState: {
        history: [
          {
            id: 1,
            type: 'user',
            text: 'Analyze configuration loading across the repo',
          },
          { id: 2, type: 'tool_group', tools: [completedTool] },
        ],
        pendingHistoryItems: [],
        streamingState: StreamingState.Idle,
        isEditorDialogOpen: false,
        embeddedShellFocused: false,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(lastFrame()).toContain('Task Trace');
    expect(lastFrame()).not.toContain('ShouldNotAppearInHistory');
    expect(mocks.traceTreeProps?.rootNodes[0]?.name).toContain(
      'Analyze configuration loading across the repo',
    );

    unmount();
  });


  it('preserves the latest trace when the underlying trace source clears at turn completion', async () => {
    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'standard',
        },
      },
    });

    const traceSnapshot: TraceNode[] = [
      {
        id: 'trace-tool-1',
        type: 'tool',
        name: 'ReadFile',
        description: 'packages/cli/src/config/config.ts',
        status: CoreToolCallStatus.Success,
        resultDisplay: 'ok',
        children: [],
      },
    ];

    let showTraceSnapshot = true;
    let setShowTraceSnapshot: ((value: boolean) => void) | null = null;
    const useTraceTreeSpy = vi
      .spyOn(traceTreeState, 'useTraceTree')
      .mockImplementation(() => ({
        tree: showTraceSnapshot ? traceSnapshot : [],
      }));

    const TransitionHarness = () => {
      const [showTrace, setShowTrace] = useState(true);
      setShowTraceSnapshot = setShowTrace;
      showTraceSnapshot = showTrace;
      return <MainContent />;
    };

    try {
      const { lastFrame, unmount } = renderWithProviders(<TransitionHarness />, {
        settings,
        uiState: {
          history: [
            { id: 1, type: 'user', text: 'Analyze configuration loading' },
          ],
          pendingHistoryItems: [],
          streamingState: StreamingState.Idle,
          isInputActive: true,
        } as Partial<UIState>,
        useAlternateBuffer: false,
      });

      await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));

      await act(async () => {
        setShowTraceSnapshot?.(false);
      });

      await waitFor(() => expect(showTraceSnapshot).toBe(false));
      await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
      expect(mocks.traceTreeProps?.rootNodes).toHaveLength(1);
      expect(mocks.traceTreeProps?.rootNodes[0]?.name).toContain(
        'Analyze configuration loading',
      );

      unmount();
    } finally {
      useTraceTreeSpy.mockRestore();
    }
  });
  it('nests tool roots under thinking-derived decision nodes', async () => {
    const decisionTool: IndividualToolCallDisplay = {
      callId: 'decision-tool-call',
      name: 'read_file',
      description: 'Decision tool',
      status: CoreToolCallStatus.Success,
      resultDisplay: undefined,
      confirmationDetails: undefined,
    };

    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'standard',
        },
      },
    });

    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      settings,
      uiState: {
        history: [
          { id: 1, type: 'user', text: 'Inspect the repo' },
          {
            id: 2,
            type: 'thinking',
            thought: {
              subject: 'Inspect config files',
              description: 'Identify likely entrypoints',
            },
          },
          { id: 3, type: 'tool_group', tools: [decisionTool] },
        ],
        pendingHistoryItems: [],
        streamingState: StreamingState.Responding,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(mocks.traceTreeProps?.rootNodes[0]?.children[0]?.type).toBe(
      'decision',
    );
    expect(mocks.traceTreeProps?.rootNodes[0]?.children[0]?.name).toBe(
      'Inspect config files',
    );
    expect(
      mocks.traceTreeProps?.rootNodes[0]?.children[0]?.children[0]?.id,
    ).toBe('decision-tool-call');

    unmount();
  });

  it('hides pending thinking text once the trace tree can represent the same work', async () => {
    const pendingTool: IndividualToolCallDisplay = {
      ...toolCall,
      callId: 'pending-read-file',
      name: 'read_file',
      description: 'Pending read',
      status: CoreToolCallStatus.Executing,
    };

    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'standard',
        },
      },
    });

    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      settings,
      uiState: {
        history: [{ id: 1, type: 'user', text: 'Inspect the repo' }],
        pendingHistoryItems: [
          {
            type: 'thinking',
            thought: {
              subject: 'I will inspect the repo structure',
              description: 'Find entry points and inspect source files',
            },
          },
          {
            type: 'tool_group',
            tools: [pendingTool],
          },
        ],
        streamingState: StreamingState.Responding,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(lastFrame()).not.toContain('I will inspect the repo structure');
    expect(mocks.traceTreeProps?.rootNodes[0]?.children[0]?.type).toBe(
      'decision',
    );

    unmount();
  });

  it('numbers repeated synthetic phase groups so iterative search-read cycles stay understandable', async () => {
    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'standard',
        },
      },
    });

    const searchToolOne: IndividualToolCallDisplay = {
      ...toolCall,
      callId: 'search-tool-one',
      name: 'search_text',
      description: 'Search one',
      status: CoreToolCallStatus.Success,
    };

    const readTool: IndividualToolCallDisplay = {
      ...toolCall,
      callId: 'read-tool',
      name: 'read_file',
      description: 'Read one',
      status: CoreToolCallStatus.Success,
    };

    const searchToolTwo: IndividualToolCallDisplay = {
      ...toolCall,
      callId: 'search-tool-two',
      name: 'search_text',
      description: 'Search two',
      status: CoreToolCallStatus.Success,
    };

    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      settings,
      uiState: {
        history: [
          { id: 1, type: 'user', text: 'Trace the config flow' },
          { id: 2, type: 'tool_group', tools: [searchToolOne] },
          { id: 3, type: 'tool_group', tools: [readTool] },
          { id: 4, type: 'tool_group', tools: [searchToolTwo] },
        ],
        pendingHistoryItems: [],
        streamingState: StreamingState.Responding,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(
      mocks.traceTreeProps?.rootNodes[0]?.children.map((child) => child.name),
    ).toEqual([
      'Discover relevant files',
      'Inspect source files',
      'Discover relevant files (2)',
    ]);

    unmount();
  });

  it('disables trace and step input capture when main content is unfocused', async () => {
    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      uiState: {
        history: [{ id: 1, type: 'tool_group', tools: [toolCall] }],
        pendingHistoryItems: [],
        stepMode: true,
        streamingState: StreamingState.Responding,
        isEditorDialogOpen: true,
        embeddedShellFocused: false,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(lastFrame()).toContain('StepActionBarMock');
    expect(mocks.traceTreeProps?.isFocused).toBe(false);
    expect(mocks.stepActionBarProps?.isActive).toBe(false);

    unmount();
  });

  it('keeps the trace tree interactive in standard mode when main content owns focus', async () => {
    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      uiState: {
        history: [{ id: 1, type: 'tool_group', tools: [toolCall] }],
        pendingHistoryItems: [],
        stepMode: true,
        streamingState: StreamingState.Responding,
        isEditorDialogOpen: false,
        embeddedShellFocused: false,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(mocks.traceTreeProps?.isActive).toBe(true);
    expect(lastFrame()).toContain('StepActionBarMock');

    unmount();
  });

  it('keeps the trace tree interactive during a live run even while the composer is visible', async () => {
    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      uiState: {
        history: [{ id: 1, type: 'tool_group', tools: [toolCall] }],
        pendingHistoryItems: [],
        stepMode: true,
        streamingState: StreamingState.Responding,
        isEditorDialogOpen: false,
        embeddedShellFocused: false,
        isInputActive: true,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(mocks.traceTreeProps?.isActive).toBe(true);

    unmount();
  });

  it('returns the trace tree to read-only after a turn finishes and the composer owns focus', async () => {
    const completedTool: IndividualToolCallDisplay = {
      ...toolCall,
      callId: 'idle-completed-tool',
      status: CoreToolCallStatus.Success,
      resultDisplay: 'done',
    };

    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'standard',
        },
      },
    });

    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      settings,
      uiState: {
        history: [
          { id: 1, type: 'user', text: 'Inspect trace details' },
          { id: 2, type: 'tool_group', tools: [completedTool] },
        ],
        pendingHistoryItems: [],
        stepMode: false,
        streamingState: StreamingState.Idle,
        isEditorDialogOpen: false,
        embeddedShellFocused: false,
        isInputActive: true,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(mocks.traceTreeProps?.isActive).toBe(false);

    unmount();
  });

  it('keeps step actions active for a paused step even while the input stays focused', async () => {
    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      uiState: {
        history: [],
        pendingHistoryItems: [
          {
            type: 'tool_group',
            tools: [toolCall],
          },
        ],
        stepMode: true,
        streamingState: StreamingState.Responding,
        isEditorDialogOpen: false,
        embeddedShellFocused: false,
        isInputActive: true,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('StepActionBarMock'));
    expect(mocks.stepActionBarProps?.isActive).toBe(true);

    unmount();
  });

  it('hides the legacy confirmation queue while step mode is active', async () => {
    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      uiState: {
        history: [{ id: 1, type: 'tool_group', tools: [toolCall] }],
        pendingHistoryItems: [],
        stepMode: true,
        streamingState: StreamingState.Responding,
        isEditorDialogOpen: false,
        embeddedShellFocused: false,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('StepActionBarMock'));
    expect(lastFrame()).not.toContain('ToolConfirmationQueueMock');
    expect(mocks.toolConfirmationQueueProps).toBeNull();

    unmount();
  });

  it('keeps trace tree navigation interactive in alternate buffer mode', async () => {
    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      uiState: {
        history: [{ id: 1, type: 'tool_group', tools: [toolCall] }],
        pendingHistoryItems: [],
        stepMode: true,
        streamingState: StreamingState.Responding,
        isEditorDialogOpen: false,
        embeddedShellFocused: false,
      } as Partial<UIState>,
      useAlternateBuffer: true,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(mocks.traceTreeProps?.isActive).toBe(true);

    unmount();
  });

  it('passes standard trace verbosity from settings to TraceTree', async () => {
    const finalTool: IndividualToolCallDisplay = {
      ...toolCall,
      callId: 'quiet-final-tool',
      status: CoreToolCallStatus.Success,
    };

    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'standard',
        },
      },
    });

    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      settings,
      uiState: {
        history: [{ id: 1, type: 'tool_group', tools: [finalTool] }],
        pendingHistoryItems: [],
        streamingState: StreamingState.Responding,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(mocks.traceTreeProps?.verbosity).toBe('standard');

    unmount();
  });


  it('uses panel detail view for live standard-mode traces to keep the tree height stable', async () => {
    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'standard',
        },
      },
    });

    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      settings,
      uiState: {
        history: [{ id: 1, type: 'tool_group', tools: [toolCall] }],
        pendingHistoryItems: [],
        streamingState: StreamingState.Responding,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(mocks.traceTreeProps?.detailView).toBe('panel');

    unmount();
  });

  it('keeps panel detail view after the turn completes in standard mode', async () => {
    const completedTool: IndividualToolCallDisplay = {
      ...toolCall,
      callId: 'completed-panel-tool',
      status: CoreToolCallStatus.Success,
      resultDisplay: 'done',
    };

    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'standard',
        },
      },
    });

    const { lastFrame, unmount } = renderWithProviders(<MainContent />, {
      settings,
      uiState: {
        history: [
          { id: 1, type: 'user', text: 'Inspect trace details' },
          { id: 2, type: 'tool_group', tools: [completedTool] },
        ],
        pendingHistoryItems: [],
        streamingState: StreamingState.Idle,
        isInputActive: true,
      } as Partial<UIState>,
      useAlternateBuffer: false,
    });

    await waitFor(() => expect(lastFrame()).toContain('TraceTreeMock'));
    expect(mocks.traceTreeProps?.detailView).toBe('panel');

    unmount();
  });
  it('hides non-final trace nodes in quiet mode', async () => {
    const runningTool: IndividualToolCallDisplay = {
      ...toolCall,
      callId: 'running-tool',
      status: CoreToolCallStatus.Executing,
    };

    const settings = createMockSettings({
      merged: {
        ui: {
          traceVerbosity: 'quiet',
        },
      },
    });

    const { lastFrame, unmount } = renderWithProviders(
      <MainContent />,
      {
        settings,
        uiState: {
          history: [{ id: 1, type: 'tool_group', tools: [runningTool] }],
          pendingHistoryItems: [],
          streamingState: StreamingState.Responding,
        } as Partial<UIState>,
        useAlternateBuffer: false,
      },
    );

    await waitFor(() => expect(lastFrame()).not.toContain('TraceTreeMock'));

    unmount();
  });
});

