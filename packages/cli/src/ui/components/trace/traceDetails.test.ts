/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  CoreToolCallStatus,
  type AnsiOutput,
} from '@google/gemini-cli-core';
import type { TraceNode } from '../../state/useTraceTree.js';
import {
  buildTraceDetailSections,
  normalizeTraceDetailContent,
} from './traceDetails.js';

function makeToolNode(overrides: Partial<TraceNode> = {}): TraceNode {
  return {
    id: 'tool-1',
    type: 'tool',
    name: 'SearchText',
    originalRequestName: 'search_text',
    description: "'config|settings' within packages/src",
    inputPreview: "'config|settings' within packages/src",
    status: CoreToolCallStatus.Success,
    children: [],
    ...overrides,
  };
}

describe('traceDetails', () => {
  it('builds structured input, output, error, and metadata sections for a tool node', () => {
    const node = makeToolNode({
      status: CoreToolCallStatus.Error,
      durationMs: 321,
      schedulerId: 'scheduler-1',
      correlationId: 'corr-1',
      progressMessage: 'Searching project files',
      progress: 2,
      progressTotal: 5,
      confirmationDetails: {
        type: 'exec',
        title: 'Run command',
        command: 'rg config src',
        rootCommand: 'rg',
        rootCommands: ['rg'],
        commands: ['rg config src', 'rg settings src'],
      },
      resultDisplay: { matches: 12, limited: true },
      errorName: 'RegexError',
      errorMessage: 'unterminated group',
    });

    const sections = buildTraceDetailSections(node);

    expect(sections.map((section) => section.id)).toEqual([
      'input',
      'output',
      'error',
      'metadata',
    ]);
    expect(sections[0]?.preview).toContain('rg config src');
    expect(sections[1]?.preview).toContain('matches');
    expect(sections[2]?.preview).toContain('unterminated group');
    expect(String(sections[3]?.content)).toContain('Duration: 321 ms');
    expect(String(sections[3]?.content)).toContain('Correlation: corr-1');
  });

  it('preserves renderable rich content and serializes generic objects safely', () => {
    const ansiOutput: AnsiOutput = [
      [
        {
          text: 'hello',
          fg: 'green',
          bg: 'black',
          bold: false,
          italic: false,
          underline: false,
          dim: false,
          inverse: false,
        },
      ],
    ];

    const diffOutput = {
      fileName: 'config.ts',
      fileDiff: '@@ -1 +1 @@',
    };

    expect(normalizeTraceDetailContent(ansiOutput)).toBe(ansiOutput);
    expect(normalizeTraceDetailContent(diffOutput)).toBe(diffOutput);
    expect(
      normalizeTraceDetailContent({ todos: [{ description: 'Review output', status: 'pending' }] }),
    ).toContain('[ ] Review output');
    expect(normalizeTraceDetailContent({ answer: 42 })).toContain('"answer": 42');
  });
});
