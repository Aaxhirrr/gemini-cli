/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { useMemo } from 'react';
import { ToolResultDisplay } from '../messages/ToolResultDisplay.js';
import { useUIState } from '../../contexts/UIStateContext.js';
import { theme } from '../../semantic-colors.js';
import type { TraceNode } from '../../state/useTraceTree.js';
import {
  buildTraceDetailSections,
  getCollapsedTracePreviewSections,
  normalizeTraceDetailContent,
  serializeTraceContent,
  type TraceDetailSection,
  type TraceDetailSectionId,
} from './traceDetails.js';

const SECTION_MAX_LINES = 18;
const PANEL_EXPANDED_PRIMARY_SECTION_LINES = 6;
const PANEL_EXPANDED_SECONDARY_SECTION_LINES = 1;

type TraceDetailsLayout = 'inline' | 'panel';
type TraceDetailsPanelMode = 'compact' | 'expanded';

interface TraceNodeDetailsProps {
  node: TraceNode;
  isSelected: boolean;
  isExpanded: boolean;
  indent: number;
  toggleHint: string;
  layout?: TraceDetailsLayout;
  panelMode?: TraceDetailsPanelMode;
  sectionMaxLines?: number;
  showMoreHint?: string;
}

interface PanelSectionDisplay {
  section: TraceDetailSection;
  visibleLines: string[];
  hiddenLineCount: number;
  isPrimary: boolean;
}

function renderSectionBorderColor(section: TraceDetailSection): string {
  return section.tone === 'error'
    ? theme.status.error
    : theme.border.default;
}

function renderSectionLabelColor(section: TraceDetailSection): string {
  return section.tone === 'error' ? theme.status.error : theme.ui.active;
}

function getPanelSectionLines(content: unknown): string[] {
  const serialized = serializeTraceContent(content).replace(/\r\n/g, '\n');
  const lines = serialized.split('\n');
  return lines.length > 0 ? lines : [''];
}

function getPanelSectionPriority(sectionId: TraceDetailSectionId): number {
  switch (sectionId) {
    case 'output':
      return 0;
    case 'input':
      return 1;
    case 'error':
      return 2;
    case 'metadata':
      return 3;
    default:
      return 99;
  }
}

function pickPrimaryPanelSectionId(
  sections: TraceDetailSection[],
  compactSectionMaxLines: number,
): TraceDetailSectionId | undefined {
  const candidates = sections.map((section) => ({
    section,
    lineCount: getPanelSectionLines(section.content).length,
  }));

  const hiddenCandidates = candidates.filter(
    ({ lineCount }) => lineCount > Math.max(1, compactSectionMaxLines),
  );
  const rankedCandidates = hiddenCandidates.length > 0 ? hiddenCandidates : candidates;
  const [primary] = rankedCandidates.sort((left, right) => {
    if (right.lineCount !== left.lineCount) {
      return right.lineCount - left.lineCount;
    }

    return (
      getPanelSectionPriority(left.section.id) -
      getPanelSectionPriority(right.section.id)
    );
  });

  return primary?.section.id;
}

function buildPanelSectionDisplay(
  section: TraceDetailSection,
  sectionMaxLines: number,
  panelMode: TraceDetailsPanelMode,
  primarySectionId: TraceDetailSectionId | undefined,
): PanelSectionDisplay {
  const allLines = getPanelSectionLines(section.content);
  const isPrimary = section.id === primarySectionId;
  const visibleLineCount = Math.max(
    1,
    panelMode === 'expanded'
      ? isPrimary
        ? PANEL_EXPANDED_PRIMARY_SECTION_LINES
        : PANEL_EXPANDED_SECONDARY_SECTION_LINES
      : sectionMaxLines,
  );

  return {
    section,
    visibleLines: allLines.slice(0, visibleLineCount),
    hiddenLineCount: Math.max(0, allLines.length - visibleLineCount),
    isPrimary,
  };
}

function formatHiddenLinesHint(
  hiddenLineCount: number,
  panelMode: TraceDetailsPanelMode,
  isPrimary: boolean,
  showMoreHint?: string,
): string {
  const suffix = hiddenLineCount === 1 ? '' : 's';
  if (showMoreHint && isPrimary) {
    const action = panelMode === 'expanded' ? 'show fewer' : 'show more';
    return `... ${hiddenLineCount} more line${suffix} hidden (${showMoreHint} to ${action}) ...`;
  }

  return `... ${hiddenLineCount} more line${suffix} hidden ...`;
}

export const TraceNodeDetails: React.FC<TraceNodeDetailsProps> = ({
  node,
  isSelected,
  isExpanded,
  indent,
  toggleHint,
  layout = 'inline',
  panelMode = 'compact',
  sectionMaxLines = SECTION_MAX_LINES,
  showMoreHint,
}) => {
  const { mainAreaWidth } = useUIState();
  const isPanel = layout === 'panel';

  const sections = useMemo(() => buildTraceDetailSections(node), [node]);
  const collapsedSections = useMemo(
    () => getCollapsedTracePreviewSections(node, isSelected),
    [node, isSelected],
  );
  const panelSections = useMemo(() => {
    if (!isPanel) {
      return [];
    }

    const primarySectionId = pickPrimaryPanelSectionId(sections, sectionMaxLines);
    return sections.map((section) =>
      buildPanelSectionDisplay(
        section,
        sectionMaxLines,
        panelMode,
        primarySectionId,
      ),
    );
  }, [isPanel, panelMode, sectionMaxLines, sections]);
  const panelHasHiddenContent = panelSections.some(
    (section) => section.hiddenLineCount > 0,
  );

  if (sections.length === 0) {
    return null;
  }

  if (!isExpanded) {
    if (isPanel || collapsedSections.length === 0) {
      return null;
    }

    return (
      <Box flexDirection="column" paddingLeft={indent} marginTop={0}>
        {collapsedSections.map((section) => (
          <Text key={section.id} color={theme.text.secondary} dimColor>
            {`${section.label}: ${section.preview}`}
          </Text>
        ))}
        {isSelected && (
          <Text color={theme.ui.active} dimColor>
            [{toggleHint} to inspect details]
          </Text>
        )}
      </Box>
    );
  }

  const terminalWidth = Math.max(20, mainAreaWidth - indent - 4);

  if (isPanel) {
    return (
      <Box flexDirection="column" marginTop={1} width="100%">
        {panelSections.map(({ section, visibleLines, hiddenLineCount, isPrimary }, index) => (
          <Box
            key={section.id}
            flexDirection="column"
            marginBottom={index === panelSections.length - 1 ? 0 : 1}
          >
            <Text bold color={renderSectionLabelColor(section)}>
              {section.label}
            </Text>
            <Box flexDirection="column" paddingLeft={2}>
              {visibleLines.map((line, lineIndex) => (
                <Text
                  key={`${section.id}-${lineIndex}`}
                  color={
                    section.tone === 'error'
                      ? theme.status.error
                      : theme.text.primary
                  }
                  wrap="truncate-end"
                >
                  {line.length > 0 ? line : ' '}
                </Text>
              ))}
              {hiddenLineCount > 0 && (
                <Text color={theme.text.secondary} dimColor>
                  {formatHiddenLinesHint(
                    hiddenLineCount,
                    panelMode,
                    isPrimary,
                    showMoreHint,
                  )}
                </Text>
              )}
            </Box>
          </Box>
        ))}
        {isSelected && (
          <Box flexDirection="column" marginTop={1}>
            {panelHasHiddenContent && showMoreHint && (
              <Text color={theme.text.secondary} dimColor>
                [{showMoreHint} to {panelMode === 'expanded' ? 'show fewer' : 'show more'} inspector details]
              </Text>
            )}
            <Text color={theme.ui.active} dimColor>
              [{toggleHint} to hide inspector]
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      paddingLeft={indent}
      marginTop={0}
      width="100%"
    >
      {sections.map((section) => (
        <Box
          key={section.id}
          flexDirection="column"
          borderStyle="round"
          borderColor={renderSectionBorderColor(section)}
          paddingX={1}
          marginBottom={1}
        >
          <Text bold color={renderSectionLabelColor(section)}>
            {section.label}
          </Text>
          <ToolResultDisplay
            resultDisplay={normalizeTraceDetailContent(section.content)}
            terminalWidth={terminalWidth}
            renderOutputAsMarkdown={section.renderOutputAsMarkdown}
            maxLines={sectionMaxLines}
            hasFocus={isSelected}
            overflowDirection="bottom"
          />
        </Box>
      ))}
      {isSelected && (
        <Text color={theme.ui.active} dimColor>
          [{toggleHint} to collapse details]
        </Text>
      )}
    </Box>
  );
};