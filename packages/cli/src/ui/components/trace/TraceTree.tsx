/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FC } from 'react';
import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { Box, Text } from 'ink';
import type { TraceNode } from '../../state/useTraceTree.js';
import { TraceNodeRow } from './TraceNodeRow.js';
import { TraceNodeDetails } from './TraceNodeDetails.js';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { useKeypress, type Key } from '../../hooks/useKeypress.js';
import { KeypressPriority } from '../../contexts/KeypressContext.js';
import type { TraceVerbosityMode } from './traceVerbosity.js';
import { theme } from '../../semantic-colors.js';
import { useKeyMatchers } from '../../hooks/useKeyMatchers.js';
import { Command } from '../../key/keyMatchers.js';
import { formatCommand } from '../../key/keybindingUtils.js';
import { hasTraceDetailSections } from './traceDetails.js';

const MAX_VIEWPORT_NODES = 15;
const VIEWPORT_PAGE_JUMP = Math.max(4, MAX_VIEWPORT_NODES - 4);
const INSPECTOR_PANEL_HEIGHT = 18;

type TraceDetailView = 'inline' | 'panel';

interface TraceTreeProps {
  rootNodes: TraceNode[];
  isActive?: boolean;
  isFocused?: boolean;
  verbosity?: TraceVerbosityMode;
  onNodeSelect?: (node: TraceNode) => void;
  detailView?: TraceDetailView;
}

interface FlattenedNode {
  node: TraceNode;
  depth: number;
  isLast: boolean;
  ancestorHasMoreSiblings: boolean[];
}

function collectAutoExpandedIds(
  nodes: TraceNode[],
  depth: number,
  ids: Set<string>,
): void {
  for (const node of nodes) {
    if (
      node.children.length > 0 &&
      (
        depth === 0 ||
        node.type === 'task' ||
        node.type === 'subagent' ||
        node.type === 'decision'
      )
    ) {
      ids.add(node.id);
    }

    if (node.children.length > 0) {
      collectAutoExpandedIds(node.children, depth + 1, ids);
    }
  }
}

function collectFailurePathIds(nodes: TraceNode[], ids: Set<string>): void {
  for (const node of nodes) {
    if (node.hasFailedDescendant || node.status === CoreToolCallStatus.Error) {
      ids.add(node.id);
    }
    if (node.children.length > 0) {
      collectFailurePathIds(node.children, ids);
    }
  }
}

function computeViewport(
  totalCount: number,
  selectedIndex: number,
  maxSize: number,
): { start: number; end: number } {
  if (totalCount <= maxSize) {
    return { start: 0, end: totalCount };
  }
  const half = Math.floor(maxSize / 2);
  let start = selectedIndex - half;
  let end = start + maxSize;

  if (start < 0) {
    start = 0;
    end = maxSize;
  } else if (end > totalCount) {
    end = totalCount;
    start = end - maxSize;
  }

  return { start, end };
}

const TraceTreeComponent: FC<TraceTreeProps> = ({
  rootNodes,
  isActive = false,
  isFocused = true,
  verbosity = 'standard',
  onNodeSelect,
  detailView = 'inline',
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(false);
  const isInteractive = isActive && isFocused;
  const keyMatchers = useKeyMatchers();
  const autoExpandedNodeIdsRef = useRef(new Set<string>());
  const usesInspectorPanel = detailView === 'panel';
  const isInspectorNavigable = usesInspectorPanel && isInspectorOpen;
  const toggleDetailsHint = isInteractive || isInspectorNavigable
    ? 'Enter'
    : formatCommand(Command.SHOW_MORE_LINES);
  const showMoreHint = formatCommand(Command.SHOW_MORE_LINES);

  useEffect(() => {
    const failureIds = new Set<string>();
    collectFailurePathIds(rootNodes, failureIds);
    const defaultExpandedIds = new Set<string>();
    collectAutoExpandedIds(rootNodes, 0, defaultExpandedIds);

    if (failureIds.size > 0) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const id of defaultExpandedIds) {
          if (!autoExpandedNodeIdsRef.current.has(id)) {
            next.add(id);
            autoExpandedNodeIdsRef.current.add(id);
            changed = true;
          }
        }
        for (const id of failureIds) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      return;
    }

    if (defaultExpandedIds.size > 0) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const id of defaultExpandedIds) {
          if (!autoExpandedNodeIdsRef.current.has(id)) {
            next.add(id);
            autoExpandedNodeIdsRef.current.add(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [rootNodes]);

  const visibleNodes = useMemo(() => {
    const flat: FlattenedNode[] = [];

    const traverse = (
      nodes: TraceNode[],
      depth: number,
      ancestorHasMoreSiblings: boolean[],
    ) => {
      nodes.forEach((node, index) => {
        const isLast = index === nodes.length - 1;
        flat.push({
          node,
          depth,
          isLast,
          ancestorHasMoreSiblings,
        });
        if (expandedNodes.has(node.id) && node.children.length > 0) {
          traverse(node.children, depth + 1, [
            ...ancestorHasMoreSiblings,
            !isLast,
          ]);
        }
      });
    };

    traverse(rootNodes, 0, []);
    return flat;
  }, [rootNodes, expandedNodes]);

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (visibleNodes.length === 0) {
        return 0;
      }
      return Math.min(prev, visibleNodes.length - 1);
    });

    const visibleIds = new Set(visibleNodes.map((item) => item.node.id));
    setExpandedDetails((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    if (visibleNodes.length === 0) {
      setIsInspectorOpen(false);
      setIsInspectorExpanded(false);
    }
  }, [visibleNodes]);

  const visibleNodesRef = useRef(visibleNodes);
  visibleNodesRef.current = visibleNodes;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const expandedNodesRef = useRef(expandedNodes);
  expandedNodesRef.current = expandedNodes;
  const expandedDetailsRef = useRef(expandedDetails);
  expandedDetailsRef.current = expandedDetails;
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;
  const isInteractiveRef = useRef(isInteractive);
  isInteractiveRef.current = isInteractive;
  const isInspectorOpenRef = useRef(isInspectorOpen);
  isInspectorOpenRef.current = isInspectorOpen;

  const handleKeypress = useCallback(
    (key: Key) => {
      const nodes = visibleNodesRef.current;
      const selIdx = selectedIndexRef.current;
      const expanded = expandedNodesRef.current;
      const detailsExpanded = expandedDetailsRef.current;
      const interactive = isInteractiveRef.current;
      const current = nodes[selIdx];

      if (nodes.length === 0) {
        return false;
      }

      const toggleCurrentDetails = () => {
        if (!current || !hasTraceDetailSections(current.node)) {
          return false;
        }

        if (usesInspectorPanel) {
          if (isInspectorOpenRef.current) {
            setIsInspectorOpen(false);
            setIsInspectorExpanded(false);
          } else {
            setIsInspectorOpen(true);
          }
          return true;
        }

        setExpandedDetails((prev) => {
          const next = new Set(prev);
          if (next.has(current.node.id)) {
            next.delete(current.node.id);
          } else {
            next.add(current.node.id);
          }
          return next;
        });
        return true;
      };

      if (key.name === 'pageup') {
        setSelectedIndex((prev) => Math.max(0, prev - VIEWPORT_PAGE_JUMP));
        return true;
      }

      if (key.name === 'pagedown') {
        setSelectedIndex((prev) =>
          Math.min(nodes.length - 1, prev + VIEWPORT_PAGE_JUMP),
        );
        return true;
      }

      if (key.name === 'home') {
        setSelectedIndex(0);
        return true;
      }

      if (key.name === 'end') {
        setSelectedIndex(nodes.length - 1);
        return true;
      }

      if (
        current &&
        keyMatchers[Command.SHOW_MORE_LINES](key) &&
        hasTraceDetailSections(current.node)
      ) {
        if (usesInspectorPanel) {
          if (!isInspectorOpenRef.current) {
            setIsInspectorOpen(true);
            setIsInspectorExpanded(false);
          } else {
            setIsInspectorExpanded((prev) => !prev);
          }
          return true;
        }

        return toggleCurrentDetails();
      }

      const allowNavigation =
        interactive || (usesInspectorPanel && isInspectorOpenRef.current);

      if (!allowNavigation) {
        return false;
      }

      if (key.name === 'up') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return true;
      }

      if (key.name === 'down') {
        setSelectedIndex((prev) => Math.min(nodes.length - 1, prev + 1));
        return true;
      }

      if (key.name === 'right' || key.name === 'space') {
        if (current && current.node.children.length > 0) {
          setExpandedNodes((prev) => {
            const next = new Set(prev);
            next.add(current.node.id);
            return next;
          });
        }
        return true;
      }

      if (key.name === 'left') {
        if (!current) {
          return true;
        }

        if (usesInspectorPanel && isInspectorOpenRef.current) {
          setIsInspectorOpen(false);
          setIsInspectorExpanded(false);
          return true;
        }

        if (!usesInspectorPanel && detailsExpanded.has(current.node.id)) {
          setExpandedDetails((prev) => {
            const next = new Set(prev);
            next.delete(current.node.id);
            return next;
          });
          return true;
        }

        if (expanded.has(current.node.id)) {
          setExpandedNodes((prev) => {
            const next = new Set(prev);
            next.delete(current.node.id);
            return next;
          });
          return true;
        }

        if (current.node.parentId) {
          const parentIndex = nodes.findIndex(
            (n) => n.node.id === current.node.parentId,
          );
          if (parentIndex !== -1) {
            setSelectedIndex(parentIndex);
          }
        }
        return true;
      }

      if (key.name === 'enter') {
        if (!current) {
          return true;
        }

        if (hasTraceDetailSections(current.node)) {
          return toggleCurrentDetails();
        }

        if (current.node.children.length > 0) {
          setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(current.node.id)) {
              next.delete(current.node.id);
            } else {
              next.add(current.node.id);
            }
            return next;
          });
          return true;
        }

        const selectCb = onNodeSelectRef.current;
        if (selectCb) {
          selectCb(current.node);
        }
        return true;
      }

      return false;
    },
    [keyMatchers, usesInspectorPanel],
  );

  const shouldCaptureNavigation = isInteractive || isInspectorNavigable;

  useKeypress(handleKeypress, {
    isActive: isFocused && visibleNodes.length > 0,
    priority: shouldCaptureNavigation
      ? KeypressPriority.Critical
      : KeypressPriority.Normal,
  });

  if (visibleNodes.length === 0) {
    return null;
  }

  const selectedNode = visibleNodes[selectedIndex]?.node ?? null;
  const selectedNodeHasDetails = selectedNode
    ? hasTraceDetailSections(selectedNode)
    : false;
  const selectedInspectorNode = usesInspectorPanel ? selectedNode : null;

  useEffect(() => {
    if (usesInspectorPanel) {
      setIsInspectorExpanded(false);
    }
  }, [selectedNode?.id, usesInspectorPanel]);

  const { start, end } = computeViewport(
    visibleNodes.length,
    selectedIndex,
    MAX_VIEWPORT_NODES,
  );
  const windowedNodes = visibleNodes.slice(start, end);
  const hasScrollUp = start > 0;
  const hasScrollDown = end < visibleNodes.length;
  const isSelectionVisible = isFocused && visibleNodes.length > 0;

  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="column" borderStyle="round" paddingX={1} width="100%">
        {hasScrollUp && (
          <Text
            color={isInteractive ? theme.ui.active : theme.text.secondary}
            dimColor={!isInteractive}
            bold={isInteractive}
          >
            {`  [PgUp] ${start} more above`}
          </Text>
        )}
        {windowedNodes.map((item, windowIndex) => {
          const globalIndex = start + windowIndex;
          const isCurrentSelection = isSelectionVisible && globalIndex === selectedIndex;
          return (
            <TraceNodeRow
              key={item.node.id}
              node={item.node}
              depth={item.depth}
              isLast={item.isLast}
              ancestorHasMoreSiblings={item.ancestorHasMoreSiblings}
              isSelected={isCurrentSelection}
              isExpanded={expandedNodes.has(item.node.id)}
              isDetailsExpanded={
                usesInspectorPanel
                  ? !!(isInspectorOpen && isCurrentSelection && hasTraceDetailSections(item.node))
                  : expandedDetails.has(item.node.id)
              }
              verbosity={verbosity}
              toggleDetailsHint={toggleDetailsHint}
              showDetailsInline={!usesInspectorPanel}
            />
          );
        })}
        {hasScrollDown && (
          <Text
            color={isInteractive ? theme.ui.active : theme.text.secondary}
            dimColor={!isInteractive}
            bold={isInteractive}
          >
            {`  [PgDn] ${visibleNodes.length - end} more below`}
          </Text>
        )}
      </Box>

      {usesInspectorPanel && (
        <Box
          flexDirection="column"
          width="100%"
          height={INSPECTOR_PANEL_HEIGHT}
          marginTop={1}
          borderStyle="round"
          borderColor={theme.border.default}
          paddingX={1}
          overflow="hidden"
        >
          <Text bold color={theme.ui.active}>
            Inspector
          </Text>
          <Box flexDirection="column" flexGrow={1} overflow="hidden">
            {selectedInspectorNode ? (
              <>
                <Text color={theme.text.secondary} dimColor wrap="truncate-end">
                  {selectedInspectorNode.name}
                </Text>
                {isInspectorOpen ? (
                  selectedNodeHasDetails ? (
                    <TraceNodeDetails
                      node={selectedInspectorNode}
                      isSelected={true}
                      isExpanded={true}
                      indent={0}
                      toggleHint={toggleDetailsHint}
                      layout="panel"
                      panelMode={isInspectorExpanded ? 'expanded' : 'compact'}
                      sectionMaxLines={2}
                      showMoreHint={showMoreHint}
                    />
                  ) : (
                    <Box marginTop={1}>
                      <Text color={theme.text.secondary} dimColor>
                        No details available for the selected node.
                      </Text>
                    </Box>
                  )
                ) : (
                  <Box marginTop={1}>
                    <Text color={theme.text.secondary} dimColor>
                      [{toggleDetailsHint}] Inspect the selected node without resizing the live trace.
                    </Text>
                  </Box>
                )}
              </>
            ) : (
              <Box marginTop={1}>
                <Text color={theme.text.secondary} dimColor>
                  Select a node to inspect its details.
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export const TraceTree = memo(TraceTreeComponent);


