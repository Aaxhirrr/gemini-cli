/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { useUIState } from '../../contexts/UIStateContext.js';
import { ToolResultDisplay } from '../messages/ToolResultDisplay.js';

/** Maximum characters to show in collapsed preview mode */
const COLLAPSED_MAX_CHARS = 80;
/** Maximum lines to show even in expanded mode (safety cap) */
const EXPANDED_MAX_LINES = 30;

interface CollapsibleOutputProps {
  /** The raw tool result display content (from TraceNode.resultDisplay) */
  content: unknown;
  /** Whether the parent row is selected/focused - controls expansion */
  isExpanded: boolean;
  /** Whether string output should use markdown rendering */
  renderOutputAsMarkdown?: boolean;
  /** Left indent for nested detail rows */
  indent?: number;
  /** Available terminal width for wrapping */
  maxWidth?: number;
}

interface DiffStat {
  model_added_lines: number;
  model_removed_lines: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDiffStat(value: unknown): value is DiffStat {
  return (
    isRecord(value) &&
    typeof value['model_added_lines'] === 'number' &&
    typeof value['model_removed_lines'] === 'number'
  );
}

/**
 * Serializes a ToolResultDisplay into a displayable string.
 * Handles: string, FileDiff, AnsiOutput, TodoList, SubagentProgress,
 * or any other object via JSON.stringify fallback.
 */
function serializeContent(content: unknown): string {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;

  // FileDiff shape detection.
  if (
    isRecord(content) &&
    typeof content['fileName'] === 'string' &&
    typeof content['fileDiff'] === 'string'
  ) {
    const fileName = content['fileName'];
    const fileDiff = content['fileDiff'];
    const maybeDiffStat = content['diffStat'];
    const diffStat = isDiffStat(maybeDiffStat) ? maybeDiffStat : undefined;
    const stat = diffStat
      ? ` (+${diffStat.model_added_lines}/-${diffStat.model_removed_lines})`
      : '';
    return `[file] ${fileName}${stat}\n${fileDiff}`;
  }

  // TodoList shape detection.
  if (isRecord(content) && Array.isArray(content['todos'])) {
    const todos = content['todos'];
    const todoLines = todos
      .map((todo) => {
        if (
          !isRecord(todo) ||
          typeof todo['description'] !== 'string' ||
          typeof todo['status'] !== 'string'
        ) {
          return null;
        }
        const icon =
          todo['status'] === 'completed'
            ? '[x]'
            : todo['status'] === 'in_progress'
              ? '[~]'
              : '[ ]';
        return `${icon} ${todo['description']}`;
      })
      .filter((line): line is string => line !== null);

    if (todoLines.length > 0) {
      return todoLines.join('\n');
    }
  }

  // AnsiOutput { ansiOutput: string } shape.
  if (isRecord(content) && typeof content['ansiOutput'] === 'string') {
    return content['ansiOutput'];
  }

  // SubagentProgress { message: string } shape.
  if (isRecord(content) && typeof content['message'] === 'string') {
    return content['message'];
  }

  // Fallback: JSON.
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

/**
 * Truncates a string to `maxChars`, appending an ellipsis if truncated.
 * Replaces newlines to keep the preview single-line.
 */
function truncatePreview(
  text: string,
  maxChars: number,
): { truncated: string; wasTruncated: boolean } {
  // Normalize to single line for preview.
  const singleLine = text.replace(/\r?\n/g, ' <nl> ').replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxChars) {
    return { truncated: singleLine, wasTruncated: false };
  }
  return { truncated: `${singleLine.slice(0, maxChars)}...`, wasTruncated: true };
}

/**
 * Caps the number of lines shown in expanded mode.
 */
function capLines(
  text: string,
  maxLines: number,
): { capped: string; lineCount: number; wasCapped: boolean } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return { capped: text, lineCount: lines.length, wasCapped: false };
  }
  const remaining = lines.length - maxLines;
  return {
    capped: `${lines.slice(0, maxLines).join('\n')}\n  ... (${remaining} more lines)`,
    lineCount: lines.length,
    wasCapped: true,
  };
}

/**
 * Renders tool output content as a collapsible block.
 *
 * - Collapsed (default): single-line truncated preview with "..." suffix
 * - Expanded (when row selected): full multi-line content, capped at EXPANDED_MAX_LINES
 */
export const CollapsibleOutput: React.FC<CollapsibleOutputProps> = ({
  content,
  isExpanded,
  renderOutputAsMarkdown,
  indent = 2,
  maxWidth,
}) => {
  const { mainAreaWidth } = useUIState();
  const serialized = serializeContent(content);
  const terminalWidth = Math.max(20, maxWidth ?? mainAreaWidth - indent);

  if (!serialized) return null;

  if (!isExpanded) {
    // Collapsed: single-line preview.
    const { truncated, wasTruncated } = truncatePreview(
      serialized,
      COLLAPSED_MAX_CHARS,
    );
    return (
      <Box paddingLeft={indent} marginTop={0}>
        <Text color={theme.text.secondary} dimColor>
          {'-> '}
          {truncated}
          {wasTruncated && (
            <Text color={theme.ui.active} dimColor>
              {' [select to expand]'}
            </Text>
          )}
        </Text>
      </Box>
    );
  }

  // Expanded: multi-line with line cap.
  const { capped, wasCapped } = capLines(serialized, EXPANDED_MAX_LINES);

  return (
    <Box
      flexDirection="column"
      paddingLeft={indent}
      marginTop={0}
      borderStyle="single"
      borderColor={theme.border.default}
      paddingX={1}
    >
      {typeof content === 'string' || (typeof content === 'object' && content !== null) ? (
        <ToolResultDisplay
          resultDisplay={content}
          terminalWidth={terminalWidth}
          renderOutputAsMarkdown={renderOutputAsMarkdown}
          maxLines={EXPANDED_MAX_LINES}
        />
      ) : (
        <Text color={theme.text.secondary}>{capped}</Text>
      )}
      {wasCapped && (
        <Text color={theme.ui.active} dimColor>
          (output truncated)
        </Text>
      )}
    </Box>
  );
};
