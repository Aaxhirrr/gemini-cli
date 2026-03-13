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
import { useMemo, memo, useCallback, useEffect, useRef } from 'react';
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
import { useToolActions } from '../contexts/ToolActionsContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import {
  CoreToolCallStatus,
  ToolConfirmationOutcome,
} from '@google/gemini-cli-core';
import { mapToDisplay } from '../hooks/toolMapping.js';
import { StreamingState } from '../types.js';
import { useSettings } from '../contexts/SettingsContext.js';
import type { ConfirmingToolState } from '../hooks/useConfirmingTool.js';
import type { TraceVerbosityMode } from './trace/traceVerbosity.js';
import { theme } from '../semantic-colors.js';
import type { HistoryItem, HistoryItemWithoutId } from '../types.js';

const MemoizedHistoryItemDisplay = memo(HistoryItemDisplay);
const MemoizedAppHeader = memo(AppHeader);
const TRACE_TASK_ROOT_ID = 'trace-task-root';

function isTraceStatusActive(status: CoreToolCallStatus): boolean {
  return (
    status === CoreToolCallStatus.Scheduled ||
    status === CoreToolCallStatus.Validating ||
    status === CoreToolCallStatus.Executing ||
    status === CoreToolCallStatus.AwaitingApproval
  );
}

function deriveAggregateTraceStatus(
  children: TraceNode[],
  isActiveFallback = false,
): CoreToolCallStatus {
  const childStatuses = children.map((child) => child.status);

  if (childStatuses.some((status) => status === CoreToolCallStatus.Error)) {
    return CoreToolCallStatus.Error;
  }
  if (
    childStatuses.some((status) => status === CoreToolCallStatus.AwaitingApproval)
  ) {
    return CoreToolCallStatus.AwaitingApproval;
  }
  if (childStatuses.some((status) => status === CoreToolCallStatus.Executing)) {
    return CoreToolCallStatus.Executing;
  }
  if (childStatuses.some((status) => status === CoreToolCallStatus.Validating)) {
    return CoreToolCallStatus.Validating;
  }
  if (childStatuses.some((status) => status === CoreToolCallStatus.Scheduled)) {
    return CoreToolCallStatus.Scheduled;
  }
  if (
    childStatuses.length > 0 &&
    childStatuses.every((status) => status === CoreToolCallStatus.Cancelled)
  ) {
    return CoreToolCallStatus.Cancelled;
  }
  if (isActiveFallback) {
    return CoreToolCallStatus.Executing;
  }
  return CoreToolCallStatus.Success;
}

function collectRootIdByDescendantId(
  rootNodes: TraceNode[],
): Map<string, string> {
  const rootIdByDescendantId = new Map<string, string>();

  const visit = (node: TraceNode, rootId: string) => {
    rootIdByDescendantId.set(node.id, rootId);
    for (const child of node.children) {
      visit(child, rootId);
    }
  };

  for (const rootNode of rootNodes) {
    visit(rootNode, rootNode.id);
  }

  return rootIdByDescendantId;
}

function getPhaseLabel(rootNode: TraceNode): string {
  if (rootNode.type === 'subagent') {
    return 'Delegate to nested agent';
  }

  const toolName = (
    rootNode.originalRequestName ??
    rootNode.name
  ).toLowerCase();

  if (
    toolName.includes('find') ||
    toolName.includes('search') ||
    toolName.includes('grep') ||
    toolName.includes('glob')
  ) {
    return 'Discover relevant files';
  }

  if (
    toolName.includes('read') ||
    toolName.includes('open') ||
    toolName.includes('list') ||
    toolName.includes('folder')
  ) {
    return 'Inspect source files';
  }

  if (toolName.includes('shell') || toolName.includes('command')) {
    return 'Run commands';
  }

  if (
    toolName.includes('edit') ||
    toolName.includes('write') ||
    toolName.includes('replace') ||
    toolName.includes('patch')
  ) {
    return 'Apply changes';
  }

  return 'Process findings';
}

function formatPhaseDecisionName(
  phaseLabel: string,
  occurrence: number,
): string {
  return occurrence > 1 ? `${phaseLabel} (${occurrence})` : phaseLabel;
}

function buildPhaseDecisionNodes(
  rootNodes: TraceNode[],
  decisionIndexStart: number,
  phaseOccurrenceCounts: Map<string, number>,
): {
  decisionNodes: Array<TraceNode & { isLatestDecision?: boolean }>;
  nextDecisionIndex: number;
} {
  if (rootNodes.length === 0) {
    return { decisionNodes: [], nextDecisionIndex: decisionIndexStart };
  }

  const decisionNodes: Array<TraceNode & { isLatestDecision?: boolean }> = [];
  let currentDecisionIndex = decisionIndexStart;
  let currentPhaseLabel: string | undefined;
  let currentPhaseNode:
    | (TraceNode & { isLatestDecision?: boolean })
    | undefined;

  for (const rootNode of rootNodes) {
    const phaseLabel = getPhaseLabel(rootNode);
    if (!currentPhaseNode || currentPhaseLabel !== phaseLabel) {
      currentDecisionIndex += 1;
      currentPhaseLabel = phaseLabel;
      const nextOccurrence = (phaseOccurrenceCounts.get(phaseLabel) ?? 0) + 1;
      phaseOccurrenceCounts.set(phaseLabel, nextOccurrence);
      currentPhaseNode = {
        id: `trace-phase-${currentDecisionIndex}`,
        parentId: TRACE_TASK_ROOT_ID,
        type: 'decision',
        name: formatPhaseDecisionName(phaseLabel, nextOccurrence),
        description: undefined,
        status: CoreToolCallStatus.Success,
        children: [],
      };
      decisionNodes.push(currentPhaseNode);
    }

    currentPhaseNode.children.push(rootNode);
  }

  return {
    decisionNodes,
    nextDecisionIndex: currentDecisionIndex,
  };
}

function buildPresentationTraceTree(
  rootNodes: TraceNode[],
  items: Array<HistoryItem | HistoryItemWithoutId>,
  taskLabel: string | undefined,
  isTraceActive: boolean,
): TraceNode[] {
  if (rootNodes.length === 0) {
    return [];
  }

  const rootNodeById = new Map(rootNodes.map((node) => [node.id, node]));
  const rootIdByDescendantId = collectRootIdByDescendantId(rootNodes);
  const assignedRootIds = new Set<string>();
  const decisionNodesById = new Map<
    string,
    TraceNode & { isLatestDecision?: boolean }
  >();
  const orderedChildren: TraceNode[] = [];
  let currentDecisionId: string | undefined;
  let currentPhaseNode:
    | (TraceNode & { isLatestDecision?: boolean })
    | undefined;
  let currentPhaseLabel: string | undefined;
  let decisionIndex = 0;
  const phaseOccurrenceCounts = new Map<string, number>();

  const appendRootToCurrentDecision = (rootId: string) => {
    const rootNode = rootNodeById.get(rootId);
    const decisionNode = currentDecisionId
      ? decisionNodesById.get(currentDecisionId)
      : undefined;

    if (!rootNode || !decisionNode || assignedRootIds.has(rootId)) {
      return;
    }

    decisionNode.children.push(rootNode);
    assignedRootIds.add(rootId);
  };

  const appendRootToPhaseDecision = (rootId: string) => {
    const rootNode = rootNodeById.get(rootId);
    if (!rootNode || assignedRootIds.has(rootId)) {
      return;
    }

    const phaseLabel = getPhaseLabel(rootNode);
    if (!currentPhaseNode || currentPhaseLabel !== phaseLabel) {
      decisionIndex += 1;
      currentPhaseLabel = phaseLabel;
      const nextOccurrence = (phaseOccurrenceCounts.get(phaseLabel) ?? 0) + 1;
      phaseOccurrenceCounts.set(phaseLabel, nextOccurrence);
      currentPhaseNode = {
        id: `trace-phase-${decisionIndex}`,
        parentId: TRACE_TASK_ROOT_ID,
        type: 'decision',
        name: formatPhaseDecisionName(phaseLabel, nextOccurrence),
        description: undefined,
        status: CoreToolCallStatus.Success,
        children: [],
      };
      orderedChildren.push(currentPhaseNode);
    }

    currentPhaseNode.children.push(rootNode);
    assignedRootIds.add(rootId);
  };

  for (const item of items) {
    if (item.type === 'thinking') {
      decisionIndex += 1;
      currentDecisionId = `trace-decision-${decisionIndex}`;
      currentPhaseNode = undefined;
      currentPhaseLabel = undefined;
      const decisionNode: TraceNode & { isLatestDecision?: boolean } = {
        id: currentDecisionId,
        parentId: TRACE_TASK_ROOT_ID,
        type: 'decision',
        name: item.thought.subject || 'Model reasoning',
        description: item.thought.description || undefined,
        status: CoreToolCallStatus.Success,
        children: [],
      };
      orderedChildren.push(decisionNode);
      decisionNodesById.set(currentDecisionId, decisionNode);
      continue;
    }

    if (item.type !== 'tool_group') {
      continue;
    }

    for (const tool of item.tools) {
      const rootId = rootIdByDescendantId.get(tool.callId);
      if (!rootId) {
        continue;
      }

      if (currentDecisionId && decisionNodesById.has(currentDecisionId)) {
        appendRootToCurrentDecision(rootId);
      } else {
        appendRootToPhaseDecision(rootId);
      }
    }
  }

  const unassignedRoots = rootNodes.filter(
    (rootNode) => !assignedRootIds.has(rootNode.id),
  );
  if (unassignedRoots.length > 0) {
    const { decisionNodes, nextDecisionIndex } = buildPhaseDecisionNodes(
      unassignedRoots,
      decisionIndex,
      phaseOccurrenceCounts,
    );
    decisionIndex = nextDecisionIndex;
    for (const phaseNode of decisionNodes) {
      orderedChildren.push(phaseNode);
    }
    for (const rootNode of unassignedRoots) {
      assignedRootIds.add(rootNode.id);
    }
  }

  for (const child of orderedChildren) {
    if (child.type === 'decision') {
      (child as TraceNode & { isLatestDecision?: boolean }).isLatestDecision =
        false;
    }
  }

  for (let i = orderedChildren.length - 1; i >= 0; i--) {
    const child = orderedChildren[i];
    if (child?.type === 'decision') {
      (child as TraceNode & { isLatestDecision?: boolean }).isLatestDecision =
        true;
      break;
    }
  }

  const normalizedChildren = orderedChildren.map((child) => {
    if (child.type !== 'decision') {
      return child;
    }

    const decisionChild = child as TraceNode & { isLatestDecision?: boolean };

    const hasActiveDescendant = decisionChild.children.some(
      (descendant) => isTraceStatusActive(descendant.status),
    );

    return {
      ...decisionChild,
      status: deriveAggregateTraceStatus(
        decisionChild.children,
        Boolean(
          decisionChild.isLatestDecision &&
            isTraceActive &&
            !hasActiveDescendant,
        ),
      ),
      isConfirming: decisionChild.children.some(
        (descendant) => descendant.isConfirming,
      ),
      hasFailedDescendant: decisionChild.children.some(
        (descendant) =>
          descendant.status === CoreToolCallStatus.Error ||
          descendant.hasFailedDescendant,
      ),
    };
  });

  return [
    {
      id: TRACE_TASK_ROOT_ID,
      type: 'task',
      name: taskLabel ?? 'Current task',
      description: undefined,
      status: deriveAggregateTraceStatus(normalizedChildren, isTraceActive),
      isConfirming: normalizedChildren.some((child) => child.isConfirming),
      hasFailedDescendant: normalizedChildren.some(
        (child) =>
          child.status === CoreToolCallStatus.Error || child.hasFailedDescendant,
      ),
      children: normalizedChildren,
    },
  ];
}

/**
 * Isolated trace section — memoized separately so that changes to
 * mainAreaWidth, staticAreaMaxItemHeight, confirmingTool, etc. do NOT
 * cause the trace tree to re-render. This prevents terminal flicker on
 * resize and during keyboard navigation within the trace.
 */
interface TraceSectionProps {
  isTraceActive: boolean;
  visibleTraceNodes: TraceNode[];
  isStepInteractionActive: boolean;
  isMainContentFocused: boolean;
  traceVerbosity: TraceVerbosityMode;
  stepMode: boolean;
  confirmingTraceNode: TraceNode | null;
  confirmingTool: ConfirmingToolState | null;
  confirm: (callId: string, outcome: ToolConfirmationOutcome) => Promise<void>;
  cancel: (callId: string) => Promise<void>;
  setStepMode: (enabled: boolean) => void;
}

const TraceSectionComponent = ({
  isTraceActive,
  visibleTraceNodes,
  isStepInteractionActive,
  isMainContentFocused,
  traceVerbosity,
  stepMode,
  confirmingTraceNode,
  confirmingTool,
  confirm,
  cancel,
  setStepMode,
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
            isActive={isStepInteractionActive}
            isFocused={isMainContentFocused}
            verbosity={traceVerbosity}
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
                ToolConfirmationOutcome.Cancel,
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
  const { setStepMode } = useUIActions();

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

  const shouldInlineTraceView = useMemo(
    () => traceVerbosity !== 'quiet' && presentationTraceNodes.length > 0,
    [traceVerbosity, presentationTraceNodes.length],
  );

  const visibleTraceNodes = useMemo(
    () =>
      traceVerbosity === 'quiet'
        ? []
        : filterTraceByVerbosity(presentationTraceNodes, traceVerbosity),
    [presentationTraceNodes, traceVerbosity],
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
        const prevType = index > 0 ? history[index - 1]?.type : undefined;
        const isFirstThinking =
          item.type === 'thinking' && prevType !== 'thinking';
        const isFirstAfterThinking =
          item.type !== 'thinking' && prevType === 'thinking';

        return {
          item,
          isExpandable,
          isFirstThinking,
          isFirstAfterThinking,
        };
      }),
    [history, lastUserPromptIndex],
  );

  const historyItems = useMemo(
    () =>
      augmentedHistory.map(
        ({ item, isExpandable, isFirstThinking, isFirstAfterThinking }) => (
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

  const historyViewRemountKey = useMemo(
    () =>
      `${uiState.historyRemountKey}:${shouldInlineTraceView ? 'trace' : 'linear'}:${rawLastUserPromptIndex}`,
    [uiState.historyRemountKey, shouldInlineTraceView, rawLastUserPromptIndex],
  );

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

  const isStepInteractionActive = useMemo(
    () =>
      !!uiState.stepMode &&
      !uiState.isInputActive &&
      isMainContentFocused,
    [uiState.stepMode, uiState.isInputActive, isMainContentFocused],
  );

  const isTraceTreeInteractive = useMemo(
    // Standard-mode terminals keep scrollback visible, and repeated arrow-key
    // redraws in that mode can corrupt the screen on some terminals. Keep the
    // trace tree read-only there while preserving step actions.
    () => isAlternateBuffer && isStepInteractionActive,
    [isAlternateBuffer, isStepInteractionActive],
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
          const isFirstThinking =
            item.type === 'thinking' && prevType !== 'thinking';
          const isFirstAfterThinking =
            item.type !== 'thinking' && prevType === 'thinking';

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
            />
          );
        })}
        {showConfirmationQueue && confirmingTool && (
          <ToolConfirmationQueue confirmingTool={confirmingTool} />
        )}
      </>
    ),
    [
      pendingTraceHistory,
      uiState.constrainHeight,
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
          isStepInteractionActive={isTraceTreeInteractive}
          isMainContentFocused={isMainContentFocused}
          traceVerbosity={traceVerbosity}
          stepMode={!!uiState.stepMode}
          confirmingTraceNode={confirmingTraceNode}
          confirmingTool={confirmingTool}
          confirm={confirm}
          cancel={cancel}
          setStepMode={setStepMode}
        />
      </Box>
    ),
    [
      pendingHistoryContent,
      isTraceActive,
      visibleTraceNodes,
      isTraceTreeInteractive,
      isMainContentFocused,
      traceVerbosity,
      uiState.stepMode,
      confirmingTraceNode,
      confirmingTool,
      confirm,
      cancel,
      setStepMode,
    ],
  );

  const virtualizedData = useMemo(
    () => [
      { type: 'header' as const },
      ...augmentedHistory.map(
        ({ item, isExpandable, isFirstThinking, isFirstAfterThinking }) => ({
          type: 'history' as const,
          item,
          isExpandable,
          isFirstThinking,
          isFirstAfterThinking,
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
        key={historyViewRemountKey}
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
