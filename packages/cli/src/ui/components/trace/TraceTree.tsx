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
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { useKeypress } from '../../hooks/useKeypress.js';
import { KeypressPriority } from '../../contexts/KeypressContext.js';
import type { TraceVerbosityMode } from './traceVerbosity.js';
import { theme } from '../../semantic-colors.js';

/**
 * Maximum number of trace nodes rendered at once.
 * Keeps the Ink dynamic-area small so redraws are fast and flicker-free.
 */
const MAX_VIEWPORT_NODES = 15;
const VIEWPORT_PAGE_JUMP = Math.max(4, MAX_VIEWPORT_NODES - 4);

interface TraceTreeProps {
  rootNodes: TraceNode[];
  isActive?: boolean;
  isFocused?: boolean;
  verbosity?: TraceVerbosityMode;
  onNodeSelect?: (node: TraceNode) => void;
}

interface FlattenedNode {
  node: TraceNode;
  depth: number;
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
    if (
      node.hasFailedDescendant ||
      node.status === CoreToolCallStatus.Error
    ) {
      ids.add(node.id);
    }
    if (node.children.length > 0) {
      collectFailurePathIds(node.children, ids);
    }
  }
}

/**
 * Compute the viewport window [start, end) for a sliding window of size
 * `maxSize` centered on `selectedIndex` within a list of `totalCount` items.
 */
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
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const isInteractive = isActive && isFocused;
  const autoExpandedNodeIdsRef = useRef(new Set<string>());

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

    const traverse = (nodes: TraceNode[], depth: number) => {
      for (const node of nodes) {
        flat.push({ node, depth });
        if (expandedNodes.has(node.id) && node.children.length > 0) {
          traverse(node.children, depth + 1);
        }
      }
    };

    traverse(rootNodes, 0);
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
    setExpandedOutputs((prev) => {
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
  }, [visibleNodes]);

  // Use refs for rapidly-changing values so the keypress handler identity
  // stays stable across renders. This prevents useKeypress from
  // re-subscribing on every selectedIndex / visibleNodes change, which
  // was a major source of flicker during keyboard navigation and streaming.
  const visibleNodesRef = useRef(visibleNodes);
  visibleNodesRef.current = visibleNodes;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const expandedNodesRef = useRef(expandedNodes);
  expandedNodesRef.current = expandedNodes;
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  const handleKeypress = useCallback(
    (key: { name: string }) => {
      const nodes = visibleNodesRef.current;
      const selIdx = selectedIndexRef.current;
      const expanded = expandedNodesRef.current;

      if (nodes.length === 0) {
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

      if (key.name === 'right' || key.name === 'space') {
        const current = nodes[selIdx];
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
        const current = nodes[selIdx];
        if (!current) {
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
        const current = nodes[selIdx];
        if (!current) {
          return true;
        }

        const hasOutput =
          current.node.resultDisplay !== undefined &&
          current.node.resultDisplay !== null;

        if (hasOutput) {
          setExpandedOutputs((prev) => {
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
    [], // stable — reads from refs
  );

  useKeypress(handleKeypress, {
    isActive: isInteractive && visibleNodes.length > 0,
    priority: KeypressPriority.Normal,
  });

  if (visibleNodes.length === 0) {
    return null;
  }

  // Viewport windowing: only render a sliding window of nodes to keep
  // the Ink dynamic render area small and prevent flicker on re-draws.
  const { start, end } = computeViewport(
    visibleNodes.length,
    selectedIndex,
    MAX_VIEWPORT_NODES,
  );
  const windowedNodes = visibleNodes.slice(start, end);
  const hasScrollUp = start > 0;
  const hasScrollDown = end < visibleNodes.length;

  return (
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
        return (
          <TraceNodeRow
            key={item.node.id}
            node={item.node}
            depth={item.depth}
            isSelected={isInteractive && globalIndex === selectedIndex}
            isExpanded={expandedNodes.has(item.node.id)}
            isOutputExpanded={expandedOutputs.has(item.node.id)}
            verbosity={verbosity}
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
  );
};

export const TraceTree = memo(TraceTreeComponent);
