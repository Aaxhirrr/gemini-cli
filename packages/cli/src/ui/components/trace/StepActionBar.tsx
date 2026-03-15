/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FC } from 'react';
import { useCallback, useRef } from 'react';
import { Box, Text, type DOMElement } from 'ink';
import { theme } from '../../semantic-colors.js';
import type { TraceNode } from '../../state/useTraceTree.js';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { useKeypress } from '../../hooks/useKeypress.js';
import { KeypressPriority } from '../../contexts/KeypressContext.js';
import { useMouseClick } from '../../hooks/useMouseClick.js';

interface StepActionBarProps {
  pendingNode: TraceNode | null;
  isActive?: boolean;
  onExecute: () => void;
  onSkip: () => void;
  onContinue: () => void;
  onCancel: () => void;
}

interface StepActionButtonProps {
  shortcut: string;
  label: string;
  color: string;
  isActive: boolean;
  onPress: () => void;
}

const StepActionButton: FC<StepActionButtonProps> = ({
  shortcut,
  label,
  color,
  isActive,
  onPress,
}) => {
  const buttonRef = useRef<DOMElement>(null);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useMouseClick(
    buttonRef,
    () => {
      onPressRef.current();
    },
    { isActive },
  );

  return (
    <Box ref={buttonRef}>
      <Text color={color}>
        <Text bold>{shortcut}</Text> {label}
      </Text>
    </Box>
  );
};

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
    priority: KeypressPriority.Critical,
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
  const areActionsInteractive = isActive && !!pendingNode;

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
          <Text
            color={theme.text.secondary}
          >{` - ${pendingNode.description}`}</Text>
        )}
      </Box>

      <Box flexDirection="row" gap={2}>
        <StepActionButton
          shortcut="[Enter]"
          label="Execute"
          color={theme.status.success}
          isActive={areActionsInteractive}
          onPress={onExecute}
        />
        <StepActionButton
          shortcut="[s]"
          label="Skip"
          color={theme.status.warning}
          isActive={areActionsInteractive}
          onPress={onSkip}
        />
        <StepActionButton
          shortcut="[c]"
          label="Continue"
          color={theme.ui.active}
          isActive={areActionsInteractive}
          onPress={onContinue}
        />
        <StepActionButton
          shortcut="[x]"
          label="Cancel"
          color={theme.status.error}
          isActive={areActionsInteractive}
          onPress={onCancel}
        />
      </Box>
    </Box>
  );
};
