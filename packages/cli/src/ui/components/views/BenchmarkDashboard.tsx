/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import type {
  BenchmarkDashboardLatestRun,
  BenchmarkRepositoryCard,
  BenchmarkTaskResult,
} from '../../types.js';

interface BenchmarkDashboardProps {
  benchmarkId: string;
  benchmarkVersion: string;
  repositoryCount: number;
  taskCount: number;
  repositoriesWithTasks: number;
  metadataOnlyRepositories: number;
  warnings: string[];
  repositories: BenchmarkRepositoryCard[];
  latestRun?: BenchmarkDashboardLatestRun;
}

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold color={theme.text.primary}>
      {title}
    </Text>
    {children}
  </Box>
);

const StatRow: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <Box>
    <Box width={28}>
      <Text color={theme.text.link}>{label}</Text>
    </Box>
    <Text color={theme.text.primary}>{value}</Text>
  </Box>
);

const renderTopCounts = (entries: Record<string, number>, limit = 5) =>
  Object.entries(entries)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit);

const renderStatusColor = (run: BenchmarkDashboardLatestRun) => {
  if (run.errored > 0 || run.failed > 0) {
    return theme.status.error;
  }
  if (run.partial > 0) {
    return theme.status.warning;
  }
  return theme.status.success;
};

const renderTaskStatusColor = (
  status: BenchmarkTaskResult['status'],
) => {
  switch (status) {
    case 'passed':
      return theme.status.success;
    case 'failed':
    case 'errored':
      return theme.status.error;
    case 'partial':
      return theme.status.warning;
    default:
      return theme.text.primary;
  }
};

const formatDurationMs = (durationMs: number) => {
  if (durationMs >= 10_000) {
    return `${Math.round(durationMs / 1000)}s`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
};

export const BenchmarkDashboard: React.FC<BenchmarkDashboardProps> = ({
  benchmarkId,
  benchmarkVersion,
  repositoryCount,
  taskCount,
  repositoriesWithTasks,
  metadataOnlyRepositories,
  warnings,
  repositories,
  latestRun,
}) => {
  const passRate = latestRun
    ? Math.round((latestRun.passed / Math.max(latestRun.totalRuns, 1)) * 100)
    : null;

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      paddingTop={1}
      paddingX={2}
      overflow="hidden"
    >
      <Text bold color={theme.text.accent}>
        Long-Context Benchmark Dashboard
      </Text>
      <Text color={theme.text.secondary}>
        {benchmarkId}@{benchmarkVersion}
      </Text>
      <Box height={1} />

      <Section title="Dataset">
        <StatRow
          label="Repositories:"
          value={
            <>
              <Text color={theme.text.accent}>{repositoryCount}</Text>{' '}
              <Text color={theme.text.secondary}>
                ({repositoriesWithTasks} runnable, {metadataOnlyRepositories}{' '}
                intake-only)
              </Text>
            </>
          }
        />
        <StatRow
          label="Tasks:"
          value={<Text color={theme.text.accent}>{taskCount}</Text>}
        />
        <StatRow
          label="Coverage:"
          value={
            repositories.length > 0
              ? repositories
                  .map((repository) => repository.repositoryId)
                  .join(', ')
              : 'No repositories loaded'
          }
        />
      </Section>

      {warnings.length > 0 && (
        <Section title="Warnings">
          {warnings.map((warning) => (
            <Text key={warning} color={theme.status.warning}>
              - {warning}
            </Text>
          ))}
        </Section>
      )}

      {latestRun && (
        <Section title="Latest Run">
          <StatRow label="Lane:" value={latestRun.label} />
          <StatRow
            label="Result:"
            value={
              <>
                <Text color={renderStatusColor(latestRun)}>
                  {passRate}% pass rate
                </Text>
                <Text color={theme.text.secondary}>
                  {' '}
                  ({latestRun.passed}/{latestRun.totalRuns} passed)
                </Text>
              </>
            }
          />
          <StatRow
            label="Failures:"
            value={
              <>
                <Text color={theme.status.success}>{latestRun.passed} passed</Text>
                <Text color={theme.text.secondary}> | </Text>
                <Text color={theme.status.error}>{latestRun.failed} failed</Text>
                <Text color={theme.text.secondary}> | </Text>
                <Text color={theme.status.error}>
                  {latestRun.errored} errored
                </Text>
                <Text color={theme.text.secondary}> | </Text>
                <Text color={theme.status.warning}>
                  {latestRun.partial} partial
                </Text>
              </>
            }
          />
          <StatRow
            label="Models:"
            value={renderTopCounts(latestRun.byModel)
              .map(([model, count]) => `${model} (${count})`)
              .join(', ')}
          />
          <StatRow
            label="Top languages:"
            value={renderTopCounts(latestRun.byLanguage)
              .map(([language, count]) => `${language} (${count})`)
              .join(', ')}
          />
          <StatRow
            label="Failure categories:"
            value={renderTopCounts(latestRun.byFailureCategory)
              .map(([category, count]) => `${category} (${count})`)
              .join(', ')}
          />
        </Section>
      )}

      {latestRun && latestRun.taskResults.length > 0 && (
        <Section title="Task Results">
          {latestRun.taskResults.map((taskResult) => (
            <Box
              key={`${taskResult.repositoryId}/${taskResult.taskId}`}
              flexDirection="column"
              marginBottom={1}
            >
              <Text>
                -{' '}
                <Text color={theme.text.accent}>
                  {taskResult.repositoryId}/{taskResult.taskId}
                </Text>{' '}
                <Text color={renderTaskStatusColor(taskResult.status)}>
                  [{taskResult.status}]
                </Text>{' '}
                <Text color={theme.text.secondary}>
                  {formatDurationMs(taskResult.durationMs)} | {taskResult.model}
                </Text>
              </Text>
              <Text color={theme.text.secondary}>
                {taskResult.summary}
              </Text>
              <Text color={theme.text.secondary}>
                validation: {taskResult.validationPassed} passed,{' '}
                {taskResult.validationFailed} failed,{' '}
                {taskResult.validationErrored} errored
                {taskResult.filesModifiedCount > 0
                  ? ` | files changed: ${taskResult.filesModifiedCount}`
                  : ` | tool calls: ${taskResult.toolCalls}`}
              </Text>
              {taskResult.resultPreview && (
                <Text color={theme.text.primary}>
                  result: {taskResult.resultPreview}
                </Text>
              )}
              {taskResult.filesModifiedSample.length > 0 && (
                <Text color={theme.text.secondary}>
                  files: {taskResult.filesModifiedSample.join(', ')}
                  {taskResult.filesModifiedCount >
                  taskResult.filesModifiedSample.length
                    ? ', ...'
                    : ''}
                </Text>
              )}
            </Box>
          ))}
        </Section>
      )}

      {latestRun && latestRun.executionLog.length > 0 && (
        <Section title="Benchmark Eval Transcript">
          {latestRun.executionLog.map((line, index) => (
            <Text key={`${index}-${line}`} color={theme.text.secondary}>
              {line}
            </Text>
          ))}
        </Section>
      )}

      <Section title="Runnable Repositories">
        {repositories.map((repository) => (
          <Box key={repository.repositoryId} flexDirection="column" marginBottom={1}>
            <Text>
              - <Text color={theme.text.accent}>{repository.repositoryId}</Text>{' '}
              <Text color={theme.text.secondary}>({repository.taskCount} task)</Text>
            </Text>
            <Text color={theme.text.secondary}>
              {repository.languages.join(', ')} | {repository.defaultBranch} |{' '}
              {repository.pinnedCommit.slice(0, 12)}
            </Text>
          </Box>
        ))}
      </Section>

      <Text color={theme.text.secondary}>
        Try: /benchmark run smoke or /benchmark run real
      </Text>
    </Box>
  );
};
