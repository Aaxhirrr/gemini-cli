/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CoreToolCallStatus,
  isSubagentProgress,
  type SerializableConfirmationDetails,
} from '@google/gemini-cli-core';
import type { TraceNode } from '../../state/useTraceTree.js';

const PREVIEW_MAX_CHARS = 96;

export type TraceDetailSectionId = 'input' | 'output' | 'error' | 'metadata';

export interface TraceDetailSection {
  id: TraceDetailSectionId;
  label: string;
  preview: string;
  content: unknown;
  renderOutputAsMarkdown?: boolean;
  tone?: 'default' | 'error';
}

interface DiffStatLike {
  model_added_lines: number;
  model_removed_lines: number;
}

interface FileDiffLike {
  fileName: string;
  fileDiff: string;
}

interface TodoLike {
  description: string;
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringProperty(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const property = value[key];
  return typeof property === 'string' ? property : undefined;
}

function getNumberProperty(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const property = value[key];
  return typeof property === 'number' ? property : undefined;
}

function getArrayProperty(
  value: Record<string, unknown>,
  key: string,
): unknown[] | undefined {
  const property = value[key];
  return Array.isArray(property) ? property : undefined;
}

function isDiffStatLike(value: unknown): value is DiffStatLike {
  return (
    isRecord(value) &&
    getNumberProperty(value, 'model_added_lines') !== undefined &&
    getNumberProperty(value, 'model_removed_lines') !== undefined
  );
}

function isFileDiffLike(value: unknown): value is FileDiffLike {
  return (
    isRecord(value) &&
    getStringProperty(value, 'fileName') !== undefined &&
    getStringProperty(value, 'fileDiff') !== undefined
  );
}

function isTodoLike(value: unknown): value is TodoLike {
  return (
    isRecord(value) &&
    getStringProperty(value, 'description') !== undefined &&
    getStringProperty(value, 'status') !== undefined
  );
}

function cleanInline(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }

  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function toDisplayCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((segment) =>
      segment.length === 0
        ? segment
        : `${segment[0].toUpperCase()}${segment.slice(1).toLowerCase()}`,
    )
    .join(' ');
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function serializeTraceContent(content: unknown): string {
  if (content === null || content === undefined) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }

  if (isFileDiffLike(content)) {
    const maybeDiffStat = isRecord(content) ? content['diffStat'] : undefined;
    const diffStat = isDiffStatLike(maybeDiffStat) ? maybeDiffStat : undefined;
    const stat = diffStat
      ? ` (+${diffStat.model_added_lines}/-${diffStat.model_removed_lines})`
      : '';
    return `[file] ${content.fileName}${stat}\n${content.fileDiff}`;
  }

  if (isRecord(content)) {
    const todos = getArrayProperty(content, 'todos');
    if (todos) {
      const todoLines = todos
        .map((todo) => {
          if (!isTodoLike(todo)) {
            return null;
          }

          const icon =
            todo.status === 'completed'
              ? '[x]'
              : todo.status === 'in_progress'
                ? '[~]'
                : '[ ]';
          return `${icon} ${todo.description}`;
        })
        .filter((line): line is string => line !== null);

      if (todoLines.length > 0) {
        return todoLines.join('\n');
      }
    }

    const ansiOutput = getStringProperty(content, 'ansiOutput');
    if (ansiOutput) {
      return ansiOutput;
    }

    const message = getStringProperty(content, 'message');
    if (message) {
      return message;
    }
  }

  return safeStringify(content);
}

export function normalizeTraceDetailContent(
  content: unknown,
): string | object | undefined {
  if (content === null || content === undefined) {
    return undefined;
  }

  if (typeof content === 'string' || Array.isArray(content)) {
    return content;
  }

  if (isFileDiffLike(content) || isSubagentProgress(content)) {
    return content;
  }

  return serializeTraceContent(content);
}

function truncatePreview(text: string, maxChars = PREVIEW_MAX_CHARS): string {
  const singleLine = text.replace(/\r?\n/g, ' <nl> ').replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxChars) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxChars - 3)}...`;
}

function buildQuestionsPreview(details: SerializableConfirmationDetails): string {
  if (details.type !== 'ask_user') {
    return '';
  }

  return details.questions
    .map((question, index) => {
      const options = (question.options ?? [])
        .map((option) => option.label)
        .join(', ');
      return options.length > 0
        ? `${index + 1}. ${question.header}: ${question.question}\n   Options: ${options}`
        : `${index + 1}. ${question.header}: ${question.question}`;
    })
    .join('\n\n');
}

function buildInputDetails(
  details: SerializableConfirmationDetails,
): { content: unknown; preview: string } | undefined {
  switch (details.type) {
    case 'edit':
      return {
        content: {
          fileName: details.fileName,
          fileDiff: details.fileDiff,
          filePath: details.filePath,
          originalContent: details.originalContent,
          newContent: details.newContent,
        },
        preview: truncatePreview(details.filePath),
      };
    case 'exec': {
      const commands = details.commands ?? [details.command];
      return {
        content: commands.join('\n'),
        preview: truncatePreview(commands[0] ?? details.command),
      };
    }
    case 'mcp': {
      const parts = [
        `Server: ${details.serverName}`,
        `Tool: ${details.toolDisplayName} (${details.toolName})`,
      ];

      if (details.toolArgs && Object.keys(details.toolArgs).length > 0) {
        parts.push('', 'Arguments:', safeStringify(details.toolArgs));
      }
      if (details.toolDescription) {
        parts.push('', 'Description:', details.toolDescription);
      }
      if (details.toolParameterSchema !== undefined) {
        parts.push('', 'Input Schema:', safeStringify(details.toolParameterSchema));
      }

      return {
        content: parts.join('\n'),
        preview: truncatePreview(
          details.toolArgs && Object.keys(details.toolArgs).length > 0
            ? safeStringify(details.toolArgs)
            : `${details.toolDisplayName} on ${details.serverName}`,
        ),
      };
    }
    case 'info':
      return {
        content: details.prompt,
        preview: truncatePreview(details.prompt),
      };
    case 'ask_user': {
      const content = buildQuestionsPreview(details);
      return {
        content,
        preview: truncatePreview(content),
      };
    }
    case 'exit_plan_mode':
      return {
        content: `Plan path: ${details.planPath}`,
        preview: truncatePreview(details.planPath),
      };
    default:
      return undefined;
  }
}

function buildInputSection(node: TraceNode): TraceDetailSection | undefined {
  const detailInput = node.confirmationDetails
    ? buildInputDetails(node.confirmationDetails)
    : undefined;

  const fallbackInputPreview =
    cleanInline(node.inputPreview) ?? cleanInline(node.description);
  const content = detailInput?.content ?? fallbackInputPreview;
  if (!content) {
    return undefined;
  }

  return {
    id: 'input',
    label: 'Input',
    preview:
      detailInput?.preview ?? truncatePreview(serializeTraceContent(content)),
    content,
    renderOutputAsMarkdown: false,
  };
}

function buildOutputSection(node: TraceNode): TraceDetailSection | undefined {
  if (
    node.resultDisplay === undefined ||
    node.resultDisplay === null ||
    (typeof node.resultDisplay === 'string' && node.resultDisplay.length === 0)
  ) {
    return undefined;
  }

  return {
    id: 'output',
    label: 'Output',
    preview: truncatePreview(serializeTraceContent(node.resultDisplay)),
    content: node.resultDisplay,
    renderOutputAsMarkdown: node.renderOutputAsMarkdown,
  };
}

function buildErrorSection(node: TraceNode): TraceDetailSection | undefined {
  const parts = [
    cleanInline(node.errorName),
    cleanInline(node.errorType),
    cleanInline(node.errorMessage),
  ].filter((part): part is string => !!part);

  if (parts.length === 0) {
    return undefined;
  }

  const content = parts.join('\n');
  return {
    id: 'error',
    label: 'Error',
    preview: truncatePreview(content),
    content,
    renderOutputAsMarkdown: false,
    tone: 'error',
  };
}

function buildMetadataSection(node: TraceNode): TraceDetailSection | undefined {
  const metadataLines = [`Status: ${toDisplayCase(node.status)}`];

  if (node.durationMs !== undefined) {
    metadataLines.push(`Duration: ${node.durationMs} ms`);
  }
  if (node.progressMessage) {
    metadataLines.push(`Progress: ${node.progressMessage}`);
  }
  if (node.progress !== undefined || node.progressTotal !== undefined) {
    metadataLines.push(
      `Progress Count: ${node.progress ?? 0}/${node.progressTotal ?? '?'}`,
    );
  }
  if (node.originalRequestName && node.originalRequestName !== node.name) {
    metadataLines.push(`Tool: ${node.originalRequestName}`);
  }
  if (node.kind) {
    metadataLines.push(`Kind: ${node.kind}`);
  }
  if (node.approvalMode) {
    metadataLines.push(`Approval Mode: ${node.approvalMode}`);
  }
  if (node.schedulerId) {
    metadataLines.push(`Scheduler: ${node.schedulerId}`);
  }
  if (node.type === 'tool') {
    metadataLines.push(`Call ID: ${node.id}`);
  }
  if (node.outputFile) {
    metadataLines.push(`Output File: ${node.outputFile}`);
  }
  if (node.ptyId !== undefined) {
    metadataLines.push(`PTY: ${node.ptyId}`);
  }
  if (node.correlationId) {
    metadataLines.push(`Correlation: ${node.correlationId}`);
  }
  if (node.isClientInitiated) {
    metadataLines.push('Client Initiated: yes');
  }
  if (node.retryCount && node.retryCount > 1) {
    metadataLines.push(`Retry Attempt: ${node.retryCount}`);
  }
  if (node.status === CoreToolCallStatus.AwaitingApproval) {
    metadataLines.push('Awaiting Approval: yes');
  }

  if (
    metadataLines.length === 1 &&
    node.type !== 'tool' &&
    node.type !== 'subagent'
  ) {
    return undefined;
  }

  const content = metadataLines.join('\n');
  return {
    id: 'metadata',
    label: 'Metadata',
    preview: truncatePreview(content),
    content,
    renderOutputAsMarkdown: false,
  };
}

export function buildTraceDetailSections(node: TraceNode): TraceDetailSection[] {
  return [
    buildInputSection(node),
    buildOutputSection(node),
    buildErrorSection(node),
    buildMetadataSection(node),
  ].filter((section): section is TraceDetailSection => section !== undefined);
}

export function hasTraceDetailSections(node: TraceNode): boolean {
  return buildTraceDetailSections(node).length > 0;
}

export function getCollapsedTracePreviewSections(
  node: TraceNode,
  isSelected: boolean,
): TraceDetailSection[] {
  const sections = buildTraceDetailSections(node);
  const primaryPreviewSections = sections.filter(
    (section) =>
      section.id === 'input' ||
      section.id === 'output' ||
      section.id === 'error',
  );

  if (isSelected) {
    return (primaryPreviewSections.length > 0
      ? primaryPreviewSections
      : sections
    ).slice(0, 3);
  }

  return primaryPreviewSections
    .filter((section) => section.id === 'output' || section.id === 'error')
    .slice(0, 1);
}
