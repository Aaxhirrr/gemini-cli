/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FC } from 'react';
import { useCallback, useRef } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import type { TraceNode } from '../../state/useTraceTree.js';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { useKeypress } from '../../hooks/useKeypress.js';
import { KeypressPriority } from '../../contexts/KeypressContext.js';

interface StepActionBarProps {
  pendingNode: TraceNode | null;
  isActive?: boolean;
  onExecute: () => void;
  onSkip: () => void;
  onContinue: () => void;
  onCancel: () => void;
}

export const StepActionBar: FC<StepActionBarProps> = ({
  pendingNode,
  isActive = false,
  onExecute,
  onSkip,
  onContinue,
  onCancel,
}) => {
  // Use refs so the keypress handler identity is stable and useKeypress
  // does not re-subscribe on every render.
  const pendingNodeRef = useRef(pendingNode);
  pendingNodeRef.current = pendingNode;
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;
  const onSkipRef = useRef(onSkip);
  onSkipRef.current = onSkip;
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const handleKeypress = useCallback(
    (key: { name: string }) => {
      if (!pendingNodeRef.current) {
        return false;
      }
      if (key.name === 'enter') {
        onExecuteRef.current();
        return true;
      }
      if (key.name === 's') {
        onSkipRef.current();
        return true;
      }
      if (key.name === 'c') {
        onContinueRef.current();
        return true;
      }
      if (key.name === 'x') {
        onCancelRef.current();
        return true;
      }
      return false;
    },
    [], // stable — reads from refs
  );

  useKeypress(handleKeypress, {
    isActive: isActive && !!pendingNode,
    priority: KeypressPriority.High,
  });

  if (!pendingNode) {
    return (
      <Box borderStyle="single" borderColor={theme.ui.active} paddingX={1}>
        <Text color={theme.ui.active}>[STEP MODE] </Text>
        <Text color={theme.text.secondary}>Waiting for next tool call...</Text>
      </Box>
    );
  }

  const isAwaitingApproval =
    pendingNode.status === CoreToolCallStatus.AwaitingApproval ||
    pendingNode.isConfirming;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isAwaitingApproval ? theme.status.warning : theme.ui.active}
      paddingX={1}
      marginTop={1}
    >
      <Box flexDirection="row" marginBottom={0}>
        <Text color={theme.status.warning} bold>
          [STEP]{' '}
        </Text>
        <Text color={theme.text.primary} bold>
          {pendingNode.name}
        </Text>
        {pendingNode.description && (
          <Text color={theme.text.secondary}>{` - ${pendingNode.description}`}</Text>
        )}
      </Box>

      <Box flexDirection="row" gap={2}>
        <Text color={theme.status.success}>
          <Text bold>[Enter]</Text> Execute
        </Text>
        <Text color={theme.status.warning}>
          <Text bold>[s]</Text> Skip
        </Text>
        <Text color={theme.ui.active}>
          <Text bold>[c]</Text> Continue
        </Text>
        <Text color={theme.status.error}>
          <Text bold>[x]</Text> Cancel
        </Text>
      </Box>
    </Box>
  );
};
