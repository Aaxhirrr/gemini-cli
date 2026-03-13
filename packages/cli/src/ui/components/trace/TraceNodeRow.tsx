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
import { CollapsibleOutput } from './CollapsibleOutput.js';
import type { TraceVerbosityMode } from './traceVerbosity.js';

const MAX_NAME_CHARS = 72;
const MAX_DESCRIPTION_CHARS = 140;

interface TraceNodeRowProps {
  node: TraceNode;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  isOutputExpanded: boolean;
  verbosity: TraceVerbosityMode;
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

function buildTreePrefix(depth: number, hasChildren: boolean, isExpanded: boolean): string {
  const guides = depth > 0 ? `${'| '.repeat(Math.max(0, depth - 1))}| ` : '';
  const branchMarker = hasChildren ? (isExpanded ? 'v ' : '> ') : '- ';
  return `${guides}${branchMarker}`;
}

const TraceNodeRowComponent: FC<TraceNodeRowProps> = ({
  node,
  depth,
  isSelected,
  isExpanded,
  isOutputExpanded,
  verbosity,
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
  const treePrefix = buildTreePrefix(depth, hasChildren, isExpanded);
  const bg = isSelected ? theme.background.focus : undefined;
  const hasOutput = node.resultDisplay !== undefined && node.resultDisplay !== null;
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

  return (
    <Box
      flexDirection="column"
      width="100%"
      marginBottom={node.type === 'decision' ? 1 : 0}
    >
      <Box flexDirection="row" width="100%" backgroundColor={bg} paddingX={1}>
        <Text color={theme.text.secondary}>{treePrefix}</Text>

        {node.hasFailedDescendant && !isError && (
          <Text color={theme.status.warning}>! </Text>
        )}

        <Text color={theme.text.secondary} dimColor>{`[${typeLabel}] `}</Text>

        <Box marginRight={1}>
          <ToolStatusIndicator status={node.status} name={node.name} />
        </Box>

        <Text
          color={statusColor}
          bold={isSelected || isError || node.type !== 'tool'}
        >
          {name}
        </Text>

        {node.retryCount && node.retryCount > 1 && (
          <Text color={theme.status.warning} bold>{` x${node.retryCount}`}</Text>
        )}

        {description && (
          <Text color={theme.text.secondary} dimColor>{` - ${description}`}</Text>
        )}

        {node.isConfirming && (
          <Text color={theme.status.warning} dimColor>
            {' (Waiting for Approval...)'}
          </Text>
        )}

        {isError && (
          <Text color={theme.status.error} bold>
            {' FAILED'}
          </Text>
        )}

        {hasOutput && !isSelected && !isError && (
          <Text color={theme.text.secondary} dimColor>
            {' [out]'}
          </Text>
        )}
      </Box>

      {hasOutput && isSelected && !isOutputExpanded && (
        <Box marginLeft={2}>
          <Text color={theme.text.secondary} dimColor>
            [Enter to expand output]
          </Text>
        </Box>
      )}

      {hasOutput && isSelected && isOutputExpanded && (
        <CollapsibleOutput content={node.resultDisplay} isExpanded={true} />
      )}

      {verbosity === 'debug' && (
        <Box marginLeft={2}>
          <Text color={theme.text.secondary} dimColor>
            {debugParts.join('  ')}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export const TraceNodeRow = memo(TraceNodeRowComponent);
