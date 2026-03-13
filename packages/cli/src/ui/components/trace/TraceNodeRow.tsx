/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo } from 'react';
import type { FC } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import type { TraceNode } from '../../state/useTraceTree.js';
import { ToolStatusIndicator } from '../messages/ToolShared.js';
import { TraceNodeDetails } from './TraceNodeDetails.js';
import { hasTraceDetailSections } from './traceDetails.js';
import type { TraceVerbosityMode } from './traceVerbosity.js';

const MAX_NAME_CHARS = 72;
const MAX_DESCRIPTION_CHARS = 140;

interface TraceNodeRowProps {
  node: TraceNode;
  depth: number;
  isLast: boolean;
  ancestorHasMoreSiblings: boolean[];
  isSelected: boolean;
  isExpanded: boolean;
  isDetailsExpanded: boolean;
  verbosity: TraceVerbosityMode;
  toggleDetailsHint: string;
  showDetailsInline: boolean;
}

function truncateInline(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 3)}...`;
}

function getNodeTypeLabel(node: TraceNode): string {
  switch (node.type) {
    case 'task':
      return 'TASK';
    case 'subagent':
      return 'AGENT';
    case 'decision':
      return 'DECISION';
    case 'tool':
    default:
      return 'TOOL';
  }
}

function buildTreePrefix(
  depth: number,
  isLast: boolean,
  ancestorHasMoreSiblings: boolean[],
): string {
  if (depth === 0) {
    return '';
  }

  const guides = ancestorHasMoreSiblings
    .slice(0, -1)
    .map((hasMoreSiblings) => (hasMoreSiblings ? '│  ' : '   '))
    .join('');
  const branchMarker = isLast ? '└─ ' : '├─ ';
  return `${guides}${branchMarker}`;
}

const TraceNodeRowComponent: FC<TraceNodeRowProps> = ({
  node,
  depth,
  isLast,
  ancestorHasMoreSiblings,
  isSelected,
  isExpanded,
  isDetailsExpanded,
  verbosity,
  toggleDetailsHint,
  showDetailsInline,
}) => {
  const isError = node.status === CoreToolCallStatus.Error;

  let statusColor = theme.text.primary;
  if (node.type === 'task') {
    statusColor = isError ? theme.status.error : theme.ui.active;
  } else if (node.type === 'decision' || node.type === 'subagent') {
    statusColor = isError ? theme.status.error : theme.text.primary;
  } else if (isError) {
    statusColor = theme.status.error;
  } else if (node.status === CoreToolCallStatus.Success) {
    statusColor = theme.status.success;
  } else if (node.status === CoreToolCallStatus.Executing) {
    statusColor = theme.ui.active;
  } else if (node.isConfirming) {
    statusColor = theme.status.warning;
  }

  const hasChildren = node.children.length > 0;
  const hasDetails = hasTraceDetailSections(node);
  const treePrefix = buildTreePrefix(depth, isLast, ancestorHasMoreSiblings);
  const bg = isSelected ? theme.background.focus : undefined;
  const name = truncateInline(node.name, MAX_NAME_CHARS);
  const description =
    verbosity !== 'quiet' && node.description
      ? truncateInline(node.description, MAX_DESCRIPTION_CHARS)
      : undefined;
  const typeLabel = getNodeTypeLabel(node);

  const debugParts: string[] = [];
  if (verbosity === 'debug') {
    debugParts.push(`id=${node.id}`);
    debugParts.push(`status=${node.status}`);
    if (node.parentId) {
      debugParts.push(`parent=${node.parentId}`);
    }
    if (node.schedulerId) {
      debugParts.push(`scheduler=${node.schedulerId}`);
    }
    if (node.durationMs !== undefined) {
      debugParts.push(`dur=${node.durationMs}ms`);
    }
  }

  const detailIndent = Math.max(2, depth * 3 + 2);
  const inlineSeparator =
    node.type === 'tool' || node.type === 'subagent' ? ': ' : ' ';
  const disclosureMarker = hasChildren ? (isExpanded ? '▾ ' : '▸ ') : '  ';

  return (
    <Box
      flexDirection="column"
      width="100%"
      marginBottom={node.type === 'decision' ? 1 : 0}
    >
      <Box flexDirection="row" width="100%" backgroundColor={bg} paddingX={1}>
        <Text color={theme.text.secondary}>{treePrefix}</Text>
        <Text color={theme.text.secondary}>{disclosureMarker}</Text>

        {node.hasFailedDescendant && !isError && (
          <Text color={theme.status.warning}>! </Text>
        )}

        {verbosity === 'debug' && (
          <Text color={theme.text.secondary} dimColor>{`[${typeLabel}] `}</Text>
        )}

        <Box flexGrow={1} flexShrink={1} overflow="hidden">
          <Text
            color={statusColor}
            bold={isSelected || isError || node.type !== 'tool'}
            wrap="truncate-end"
          >
            {name}
            {description && (
              <Text color={theme.text.secondary} dimColor>
                {`${inlineSeparator}${truncateInline(description, MAX_DESCRIPTION_CHARS)}`}
              </Text>
            )}
            {node.retryCount && node.retryCount > 1 && (
              <Text color={theme.status.warning} bold>{` x${node.retryCount}`}</Text>
            )}
            {node.isConfirming && (
              <Text color={theme.status.warning} dimColor>
                {' waiting'}
              </Text>
            )}
            {isError && (
              <Text color={theme.status.error} bold>
                {' failed'}
              </Text>
            )}
            {hasDetails && !isDetailsExpanded && isSelected && (
              <Text color={theme.ui.active} dimColor>
                {`  [${toggleDetailsHint}]`}
              </Text>
            )}
            {hasDetails && isDetailsExpanded && isSelected && !showDetailsInline && (
              <Text color={theme.ui.active} dimColor>
                {'  inspector open'}
              </Text>
            )}
          </Text>
        </Box>

        <ToolStatusIndicator status={node.status} name={node.name} />
      </Box>

      {hasDetails && showDetailsInline && (
        <TraceNodeDetails
          node={node}
          isSelected={isSelected}
          isExpanded={isDetailsExpanded}
          indent={detailIndent}
          toggleHint={toggleDetailsHint}
          layout="inline"
        />
      )}

      {verbosity === 'debug' && debugParts.length > 0 && (
        <Box paddingLeft={detailIndent}>
          <Text color={theme.text.secondary} dimColor>
            {debugParts.join('  ')}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export const TraceNodeRow = memo(TraceNodeRowComponent);
