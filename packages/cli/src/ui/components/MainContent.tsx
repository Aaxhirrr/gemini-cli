/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Static, Text } from 'ink';
import { HistoryItemDisplay } from './HistoryItemDisplay.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useAppContext } from '../contexts/AppContext.js';
import { AppHeader } from './AppHeader.js';
import { useAlternateBuffer } from '../hooks/useAlternateBuffer.js';
import {
  SCROLL_TO_ITEM_END,
  type VirtualizedListRef,
} from './shared/VirtualizedList.js';
import { ScrollableList } from './shared/ScrollableList.js';
import {
  useMemo,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { MAX_GEMINI_MESSAGE_LINES } from '../constants.js';
import { useConfirmingTool } from '../hooks/useConfirmingTool.js';
import { ToolConfirmationQueue } from './ToolConfirmationQueue.js';
import { useTraceTree, type TraceNode } from '../state/useTraceTree.js';
import { TraceTree } from './trace/TraceTree.js';
import { StepActionBar } from './trace/StepActionBar.js';
import {
  filterTraceByVerbosity,
  resolveTraceVerbosity,
} from './trace/traceVerbosity.js';
import { buildPresentationTraceTree } from './trace/presentationTree.js';
import { useToolActions } from '../contexts/ToolActionsContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import { ToolConfirmationOutcome } from '@google/gemini-cli-core';
import { mapToDisplay } from '../hooks/toolMapping.js';
import { StreamingState } from '../types.js';
import { useSettings } from '../contexts/SettingsContext.js';
import type { ConfirmingToolState } from '../hooks/useConfirmingTool.js';
import type { TraceVerbosityMode } from './trace/traceVerbosity.js';
import { theme } from '../semantic-colors.js';
import type { HistoryItemWithoutId } from '../types.js';

const MemoizedHistoryItemDisplay = memo(HistoryItemDisplay);
const MemoizedAppHeader = memo(AppHeader);

function shouldAddLeadingSpacing(
  previousItem: HistoryItemWithoutId | undefined,
  currentItem: HistoryItemWithoutId,
): boolean {
  return (
    previousItem?.type === 'gemini' &&
    currentItem.type === 'gemini' &&
    !previousItem.text.endsWith('\n')
  );
}

/**
 * Isolated trace section - memoized separately so that changes to
 * mainAreaWidth, staticAreaMaxItemHeight, confirmingTool, etc. do NOT
 * cause the trace tree to re-render. This prevents terminal flicker on
 * resize and during keyboard navigation within the trace.
 */
interface TraceSectionProps {
  isTraceActive: boolean;
  visibleTraceNodes: TraceNode[];
  isTraceTreeInteractive: boolean;
  isStepInteractionActive: boolean;
  isMainContentFocused: boolean;
  traceVerbosity: TraceVerbosityMode;
  stepMode: boolean;
  confirmingTraceNode: TraceNode | null;
  confirmingTool: ConfirmingToolState | null;
  confirm: (callId: string, outcome: ToolConfirmationOutcome) => Promise<void>;
  cancel: (callId: string) => Promise<void>;
  setStepMode: (enabled: boolean) => void;
  detailView: 'inline' | 'panel';
}

const TraceSectionComponent = ({
  isTraceActive,
  visibleTraceNodes,
  isTraceTreeInteractive,
  isStepInteractionActive,
  isMainContentFocused,
  traceVerbosity,
  stepMode,
  confirmingTraceNode,
  confirmingTool,
  confirm,
  cancel,
  setStepMode,
  detailView,
}: TraceSectionProps) => {
  if (visibleTraceNodes.length === 0 && !stepMode) {
    return null;
  }

  return (
    <Box flexDirection="column" width="100%" marginTop={1}>
      {visibleTraceNodes.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={theme.ui.active}>
            Task Trace
          </Text>
          <Text color={theme.text.secondary} dimColor>
            {isTraceActive ? 'Live execution tree' : 'Latest completed turn'}
          </Text>
        </Box>
      )}
      {visibleTraceNodes.length > 0 && (
        <Box paddingY={1} width="100%">
          <TraceTree
            rootNodes={visibleTraceNodes}
            isActive={isTraceTreeInteractive}
            isFocused={isMainContentFocused}
            verbosity={traceVerbosity}
            detailView={detailView}
          />
        </Box>
      )}
      {stepMode && (
        <StepActionBar
          pendingNode={confirmingTraceNode}
          isActive={isStepInteractionActive}
          onExecute={() => {
            if (confirmingTool) {
              void confirm(
                confirmingTool.tool.callId,
                ToolConfirmationOutcome.ProceedOnce,
              );
            }
          }}
          onSkip={() => {
            if (confirmingTool) {
              void confirm(
                confirmingTool.tool.callId,
                ToolConfirmationOutcome.Skip,
              );
            }
          }}
          onContinue={() => {
            if (confirmingTool) {
              void confirm(
                confirmingTool.tool.callId,
                ToolConfirmationOutcome.ProceedOnce,
              );
            }
            setStepMode(false);
          }}
          onCancel={() => {
            if (confirmingTool) {
              void cancel(confirmingTool.tool.callId);
            }
          }}
        />
      )}
    </Box>
  );
};

const MemoizedTraceSection = memo(TraceSectionComponent);

// Limit Gemini messages to a very high number of lines to mitigate performance
// issues in the worst case if we somehow get an enormous response from Gemini.
// This threshold is arbitrary but should be high enough to never impact normal
// usage.
export const MainContent = () => {
  const { version } = useAppContext();
  const uiState = useUIState();
  const settings = useSettings();
  const isAlternateBuffer = useAlternateBuffer();

  const confirmingTool = useConfirmingTool();
  const showConfirmationQueue = confirmingTool !== null;
  const confirmingToolCallId = confirmingTool?.tool.callId;

  const { confirm, cancel } = useToolActions();
  const { setStepMode, refreshStatic } = useUIActions();

  const scrollableListRef = useRef<VirtualizedListRef<unknown>>(null);

  useEffect(() => {
    if (showConfirmationQueue) {
      scrollableListRef.current?.scrollToEnd();
    }
  }, [showConfirmationQueue, confirmingToolCallId]);

  const {
    pendingHistoryItems,
    mainAreaWidth,
    staticAreaMaxItemHeight,
    cleanUiDetailsVisible,
  } = uiState;
  const showHeaderDetails = cleanUiDetailsVisible;
  const isMainContentFocused =
    !uiState.isEditorDialogOpen && !uiState.embeddedShellFocused;

  const rawLastUserPromptIndex = useMemo(() => {
    for (let i = uiState.history.length - 1; i >= 0; i--) {
      const type = uiState.history[i].type;
      if (type === 'user' || type === 'user_shell') {
        return i;
      }
    }
    return -1;
  }, [uiState.history]);

  const currentTurnHistory = useMemo(
    () =>
      rawLastUserPromptIndex >= 0
        ? uiState.history.slice(rawLastUserPromptIndex + 1)
        : uiState.history,
    [uiState.history, rawLastUserPromptIndex],
  );

  const liveTraceTools = useMemo(
    () => mapToDisplay(uiState.pendingToolCalls ?? []).tools,
    [uiState.pendingToolCalls],
  );

  const isTraceActive = useMemo(
    () =>
      uiState.streamingState !== StreamingState.Idle ||
      pendingHistoryItems.length > 0 ||
      liveTraceTools.length > 0,
    [uiState.streamingState, pendingHistoryItems, liveTraceTools],
  );

  const { tree: rootTraceNodes } = useTraceTree(
    currentTurnHistory,
    pendingHistoryItems,
    liveTraceTools,
  );

  const traceVerbosity = useMemo(() => {
    const resolved = resolveTraceVerbosity(
      process.env['GEMINI_TRACE_VERBOSITY'],
      settings.merged.ui.traceVerbosity,
    );
    if (uiState.stepMode && resolved === 'quiet') {
      return 'standard';
    }
    return resolved;
  }, [settings.merged.ui.traceVerbosity, uiState.stepMode]);

  const traceTaskLabel = useMemo(() => {
    if (rawLastUserPromptIndex < 0) {
      return undefined;
    }

    const promptItem = uiState.history[rawLastUserPromptIndex];
    if (
      !promptItem ||
      (promptItem.type !== 'user' && promptItem.type !== 'user_shell')
    ) {
      return undefined;
    }

    const normalizedText = promptItem.text.replace(/\s+/g, ' ').trim();
    if (normalizedText.length <= 120) {
      return normalizedText;
    }

    return `${normalizedText.slice(0, 117)}...`;
  }, [uiState.history, rawLastUserPromptIndex]);

  const presentationTraceNodes = useMemo(
    () =>
      buildPresentationTraceTree(
        rootTraceNodes,
        [...currentTurnHistory, ...pendingHistoryItems],
        traceTaskLabel,
        isTraceActive,
      ),
    [
      rootTraceNodes,
      currentTurnHistory,
      pendingHistoryItems,
      traceTaskLabel,
      isTraceActive,
    ],
  );

  const traceTurnKey = useMemo(() => {
    if (rawLastUserPromptIndex < 0) {
      return 'no-active-trace-turn';
    }

    const promptItem = uiState.history[rawLastUserPromptIndex];
    return promptItem ? 'trace-turn:' + promptItem.id : 'no-active-trace-turn';
  }, [uiState.history, rawLastUserPromptIndex]);

  const preservedTraceRef = useRef<{
    turnKey: string;
    nodes: TraceNode[];
  }>({
    turnKey: 'no-active-trace-turn',
    nodes: [],
  });

  useEffect(() => {
    if (presentationTraceNodes.length > 0) {
      preservedTraceRef.current = {
        turnKey: traceTurnKey,
        nodes: presentationTraceNodes,
      };
      return;
    }

    if (preservedTraceRef.current.turnKey !== traceTurnKey) {
      preservedTraceRef.current = {
        turnKey: traceTurnKey,
        nodes: [],
      };
    }
  }, [presentationTraceNodes, traceTurnKey]);

  const effectivePresentationTraceNodes = useMemo(() => {
    if (presentationTraceNodes.length > 0) {
      return presentationTraceNodes;
    }

    return preservedTraceRef.current.turnKey === traceTurnKey
      ? preservedTraceRef.current.nodes
      : [];
  }, [presentationTraceNodes, traceTurnKey]);

  const shouldInlineTraceView = useMemo(
    () => traceVerbosity !== 'quiet' && effectivePresentationTraceNodes.length > 0,
    [traceVerbosity, effectivePresentationTraceNodes.length],
  );

  const visibleTraceNodes = useMemo(
    () =>
      traceVerbosity === 'quiet'
        ? []
        : filterTraceByVerbosity(
            effectivePresentationTraceNodes,
            traceVerbosity,
          ),
    [effectivePresentationTraceNodes, traceVerbosity],
  );

  const history = useMemo(
    () =>
      uiState.history.filter(
        (item, index) =>
          !(
            shouldInlineTraceView &&
            index > rawLastUserPromptIndex &&
            (item.type === 'tool_group' || item.type === 'thinking')
          ),
      ),
    [uiState.history, shouldInlineTraceView, rawLastUserPromptIndex],
  );

  const lastUserPromptIndex = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const type = history[i].type;
      if (type === 'user' || type === 'user_shell') {
        return i;
      }
    }
    return -1;
  }, [history]);

  const augmentedHistory = useMemo(
    () =>
      history.map((item, index) => {
        const isExpandable = index > lastUserPromptIndex;
        const previousItem = index > 0 ? history[index - 1] : undefined;
        const prevType = previousItem?.type;
        const isFirstThinking =
          item.type === 'thinking' && prevType !== 'thinking';
        const isFirstAfterThinking =
          item.type !== 'thinking' && prevType === 'thinking';
        const hasLeadingSpacing = shouldAddLeadingSpacing(previousItem, item);

        return {
          item,
          isExpandable,
          isFirstThinking,
          isFirstAfterThinking,
          hasLeadingSpacing,
        };
      }),
    [history, lastUserPromptIndex],
  );

  const historyItems = useMemo(
    () =>
      augmentedHistory.map(
        ({
          item,
          isExpandable,
          isFirstThinking,
          isFirstAfterThinking,
          hasLeadingSpacing,
        }) => (
          <MemoizedHistoryItemDisplay
            terminalWidth={mainAreaWidth}
            availableTerminalHeight={
              uiState.constrainHeight || !isExpandable
                ? staticAreaMaxItemHeight
                : undefined
            }
            availableTerminalHeightGemini={MAX_GEMINI_MESSAGE_LINES}
            key={item.id}
            item={item}
            isPending={false}
            commands={uiState.slashCommands}
            isExpandable={isExpandable}
            isFirstThinking={isFirstThinking}
            isFirstAfterThinking={isFirstAfterThinking}
            hasLeadingSpacing={hasLeadingSpacing}
          />
        ),
      ),
    [
      augmentedHistory,
      mainAreaWidth,
      staticAreaMaxItemHeight,
      uiState.slashCommands,
      uiState.constrainHeight,
    ],
  );

  const staticHistoryItems = useMemo(
    () => historyItems.slice(0, lastUserPromptIndex + 1),
    [historyItems, lastUserPromptIndex],
  );

  const lastResponseHistoryItems = useMemo(
    () => historyItems.slice(lastUserPromptIndex + 1),
    [historyItems, lastUserPromptIndex],
  );

  const previousInlineTraceViewRef = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    if (isAlternateBuffer) {
      previousInlineTraceViewRef.current = shouldInlineTraceView;
      return;
    }

    const previousInlineTraceView = previousInlineTraceViewRef.current;
    previousInlineTraceViewRef.current = shouldInlineTraceView;

    // In standard terminal mode, swapping between the linear thought/tool log
    // and the structured trace tree must go through refreshStatic(), otherwise
    // Ink reprints the header/history and leaves duplicated copies on screen.
    if (
      previousInlineTraceView !== null &&
      previousInlineTraceView !== shouldInlineTraceView
    ) {
      refreshStatic();
    }
  }, [isAlternateBuffer, shouldInlineTraceView, refreshStatic]);

  // Recursively find the first confirming node in the trace tree
  const findConfirmingNode = useCallback(
    (nodes: TraceNode[]): TraceNode | null => {
      for (const node of nodes) {
        if (node.isConfirming) return node;
        const found = findConfirmingNode(node.children);
        if (found) return found;
      }
      return null;
    },
    [],
  );

  const confirmingTraceNode = useMemo(
    () => findConfirmingNode(rootTraceNodes),
    [rootTraceNodes, findConfirmingNode],
  );

  const traceDetailView = useMemo<'inline' | 'panel'>(
    () => (isAlternateBuffer ? 'inline' : 'panel'),
    [isAlternateBuffer],
  );

  const isStepInteractionActive = useMemo(
    () =>
      !!uiState.stepMode &&
      isMainContentFocused &&
      (!!confirmingTool || !!confirmingTraceNode || !uiState.isInputActive),
    [
      uiState.stepMode,
      isMainContentFocused,
      confirmingTool,
      confirmingTraceNode,
      uiState.isInputActive,
    ],
  );

  const isTraceTreeInteractive = useMemo(
    () =>
      isMainContentFocused &&
      (
        isAlternateBuffer ||
        uiState.streamingState !== StreamingState.Idle ||
        uiState.stepMode ||
        !uiState.isInputActive
      ),
    [
      isMainContentFocused,
      isAlternateBuffer,
      uiState.streamingState,
      uiState.stepMode,
      uiState.isInputActive,
    ],
  );

  // Split pendingItems into two parts:
  // 1. pendingHistoryContent: depends on mainAreaWidth/staticAreaMaxItemHeight (resize-sensitive)
  // 2. MemoizedTraceSection: isolated from resize, only depends on trace state
  const pendingTraceHistory = useMemo(
    () =>
      pendingHistoryItems.filter(
        (item): item is HistoryItemWithoutId =>
          !(
            shouldInlineTraceView &&
            (item.type === 'tool_group' || item.type === 'thinking')
          ),
      ),
    [pendingHistoryItems, shouldInlineTraceView],
  );

  const pendingHistoryContent = useMemo(
    () => (
      <>
        {pendingTraceHistory.map((item, i) => {
          const prevType =
            i === 0
              ? history.at(-1)?.type
              : pendingTraceHistory[i - 1]?.type;
          const previousItem =
            i === 0 ? history.at(-1) : pendingTraceHistory[i - 1];
          const isFirstThinking =
            item.type === 'thinking' && prevType !== 'thinking';
          const isFirstAfterThinking =
            item.type !== 'thinking' && prevType === 'thinking';
          const hasLeadingSpacing = shouldAddLeadingSpacing(previousItem, item);

          return (
            <HistoryItemDisplay
              key={i}
              availableTerminalHeight={
                uiState.constrainHeight ? staticAreaMaxItemHeight : undefined
              }
              terminalWidth={mainAreaWidth}
              item={{ ...item, id: 0 }}
              isPending={true}
              isExpandable={true}
              isFirstThinking={isFirstThinking}
              isFirstAfterThinking={isFirstAfterThinking}
              hasLeadingSpacing={hasLeadingSpacing}
            />
          );
        })}
        {!uiState.stepMode && showConfirmationQueue && confirmingTool && (
          <ToolConfirmationQueue confirmingTool={confirmingTool} />
        )}
      </>
    ),
    [
      pendingTraceHistory,
      uiState.constrainHeight,
      uiState.stepMode,
      staticAreaMaxItemHeight,
      mainAreaWidth,
      showConfirmationQueue,
      confirmingTool,
      history,
    ],
  );

  const pendingItems = useMemo(
    () => (
      <Box flexDirection="column" width="100%">
        {pendingHistoryContent}
        <MemoizedTraceSection
          isTraceActive={isTraceActive}
          visibleTraceNodes={visibleTraceNodes}
          isTraceTreeInteractive={isTraceTreeInteractive}
          isStepInteractionActive={isStepInteractionActive}
          isMainContentFocused={isMainContentFocused}
          traceVerbosity={traceVerbosity}
          stepMode={!!uiState.stepMode}
          confirmingTraceNode={confirmingTraceNode}
          confirmingTool={confirmingTool}
          confirm={confirm}
          cancel={cancel}
          setStepMode={setStepMode}
          detailView={traceDetailView}
        />
      </Box>
    ),
    [
      pendingHistoryContent,
      isTraceActive,
      visibleTraceNodes,
      isTraceTreeInteractive,
      isStepInteractionActive,
      isMainContentFocused,
      traceVerbosity,
      uiState.stepMode,
      confirmingTraceNode,
      confirmingTool,
      confirm,
      cancel,
      setStepMode,
      traceDetailView,
    ],
  );

  const virtualizedData = useMemo(
    () => [
      { type: 'header' as const },
      ...augmentedHistory.map(
        ({
          item,
          isExpandable,
          isFirstThinking,
          isFirstAfterThinking,
          hasLeadingSpacing,
        }) => ({
          type: 'history' as const,
          item,
          isExpandable,
          isFirstThinking,
          isFirstAfterThinking,
          hasLeadingSpacing,
        }),
      ),
      { type: 'pending' as const },
    ],
    [augmentedHistory],
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof virtualizedData)[number] }) => {
      if (item.type === 'header') {
        return (
          <MemoizedAppHeader
            key="app-header"
            version={version}
            showDetails={showHeaderDetails}
          />
        );
      } else if (item.type === 'history') {
        return (
          <MemoizedHistoryItemDisplay
            terminalWidth={mainAreaWidth}
            availableTerminalHeight={
              uiState.constrainHeight || !item.isExpandable
                ? staticAreaMaxItemHeight
                : undefined
            }
            availableTerminalHeightGemini={MAX_GEMINI_MESSAGE_LINES}
            key={item.item.id}
            item={item.item}
            isPending={false}
            commands={uiState.slashCommands}
            isExpandable={item.isExpandable}
            isFirstThinking={item.isFirstThinking}
            isFirstAfterThinking={item.isFirstAfterThinking}
            hasLeadingSpacing={item.hasLeadingSpacing}
          />
        );
      } else {
        return pendingItems;
      }
    },
    [
      showHeaderDetails,
      version,
      mainAreaWidth,
      uiState.slashCommands,
      pendingItems,
      uiState.constrainHeight,
      staticAreaMaxItemHeight,
    ],
  );

  if (isAlternateBuffer) {
    return (
      <ScrollableList
        ref={scrollableListRef}
        hasFocus={isMainContentFocused}
        width={uiState.terminalWidth}
        data={virtualizedData}
        renderItem={renderItem}
        estimatedItemHeight={() => 100}
        keyExtractor={(item, _index) => {
          if (item.type === 'header') return 'header';
          if (item.type === 'history') return item.item.id.toString();
          return 'pending';
        }}
        initialScrollIndex={SCROLL_TO_ITEM_END}
        initialScrollOffsetInIndex={SCROLL_TO_ITEM_END}
      />
    );
  }

  return (
    <>
      <Static
        key={uiState.historyRemountKey}
        items={[
          <AppHeader key="app-header" version={version} />,
          ...staticHistoryItems,
          ...lastResponseHistoryItems,
        ]}
      >
        {(item) => item}
      </Static>
      {pendingItems}
    </>
  );
};







