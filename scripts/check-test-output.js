/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const OUTPUT_PATTERNS = {
  ignoreFileNotFound: /Ignore file not found:/g,
  startupLogs: /\[STARTUP\]/g,
  rawTestWrites: /^TEST:/gm,
  maxListenersWarnings: /MaxListenersExceededWarning/g,
  watchBuildLogs: /^\[watch\] build (started|finished)$/gm,
};

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

export function analyzeOutput(output) {
  const normalizedOutput = normalizeNewlines(output);
  const lineCount =
    normalizedOutput.length === 0 ? 0 : normalizedOutput.split('\n').length;

  const patternCounts = Object.fromEntries(
    Object.entries(OUTPUT_PATTERNS).map(([name, pattern]) => [
      name,
      normalizedOutput.match(pattern)?.length ?? 0,
    ]),
  );

  return {
    bytes: Buffer.byteLength(output, 'utf8'),
    lines: lineCount,
    patternCounts,
  };
}

export function parsePatternThresholds(entries) {
  return entries.map((entry) => {
    const [name, rawLimit] = entry.split('=');
    if (!name || rawLimit === undefined) {
      throw new Error(
        `Invalid --max-pattern value "${entry}". Expected the format name=value.`,
      );
    }

    if (!(name in OUTPUT_PATTERNS)) {
      throw new Error(
        `Unknown pattern "${name}". Expected one of: ${Object.keys(OUTPUT_PATTERNS).join(', ')}.`,
      );
    }

    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error(
        `Invalid limit "${rawLimit}" for pattern "${name}". Expected a non-negative integer.`,
      );
    }

    return { name, limit };
  });
}

export function findThresholdViolations(analysis, thresholds) {
  const violations = [];

  if (
    thresholds.maxLines !== undefined &&
    analysis.lines > thresholds.maxLines
  ) {
    violations.push(
      `line count ${analysis.lines} exceeds max-lines ${thresholds.maxLines}`,
    );
  }

  if (
    thresholds.maxBytes !== undefined &&
    analysis.bytes > thresholds.maxBytes
  ) {
    violations.push(
      `byte count ${analysis.bytes} exceeds max-bytes ${thresholds.maxBytes}`,
    );
  }

  for (const { name, limit } of thresholds.maxPatterns) {
    const actual = analysis.patternCounts[name] ?? 0;
    if (actual > limit) {
      violations.push(
        `pattern "${name}" matched ${actual} times and exceeds limit ${limit}`,
      );
    }
  }

  return violations;
}

async function captureCommandOutput(command) {
  const shellCommand =
    process.platform === 'win32'
      ? {
          file: 'powershell',
          args: ['-NoProfile', '-Command', command],
        }
      : {
          file: 'sh',
          args: ['-lc', command],
        };

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(shellCommand.file, shellCommand.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (error) => {
      rejectPromise(error);
    });

    child.on('close', (code) => {
      resolvePromise({
        code: code ?? 1,
        output,
      });
    });
  });
}

function printSummary(source, exitCode, analysis) {
  console.log('Test output analysis');
  console.log(`Source: ${source}`);
  if (exitCode !== undefined) {
    console.log(`Command exit code: ${exitCode}`);
  }
  console.log(`Bytes: ${analysis.bytes}`);
  console.log(`Lines: ${analysis.lines}`);
  console.log('Pattern counts:');
  for (const [name, count] of Object.entries(analysis.patternCounts)) {
    console.log(`  ${name}: ${count}`);
  }
}

export async function runCheckTestOutput(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      command: { type: 'string' },
      input: { type: 'string' },
      output: { type: 'string' },
      'max-lines': { type: 'string' },
      'max-bytes': { type: 'string' },
      'max-pattern': { type: 'string', multiple: true },
      'allow-command-failure': { type: 'boolean' },
    },
    strict: true,
  });

  if (!values.command && !values.input) {
    throw new Error('Provide either --command or --input.');
  }

  if (values.command && values.input) {
    throw new Error('Use either --command or --input, not both.');
  }

  const maxLines =
    values['max-lines'] !== undefined ? Number(values['max-lines']) : undefined;
  const maxBytes =
    values['max-bytes'] !== undefined ? Number(values['max-bytes']) : undefined;

  if (maxLines !== undefined && (!Number.isInteger(maxLines) || maxLines < 0)) {
    throw new Error(`Invalid --max-lines value "${values['max-lines']}".`);
  }

  if (maxBytes !== undefined && (!Number.isInteger(maxBytes) || maxBytes < 0)) {
    throw new Error(`Invalid --max-bytes value "${values['max-bytes']}".`);
  }

  const maxPatterns = parsePatternThresholds(values['max-pattern'] ?? []);

  let output;
  let source;
  let exitCode;

  if (values.command) {
    source = `command "${values.command}"`;
    const result = await captureCommandOutput(values.command);
    output = result.output;
    exitCode = result.code;
  } else {
    const inputPath = resolve(values.input);
    source = `file "${inputPath}"`;
    output = await readFile(inputPath, 'utf8');
  }

  if (values.output) {
    const outputPath = resolve(values.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, 'utf8');
  }

  const analysis = analyzeOutput(output);
  printSummary(source, exitCode, analysis);

  if (
    exitCode !== undefined &&
    exitCode !== 0 &&
    !values['allow-command-failure']
  ) {
    console.error(`Command failed with exit code ${exitCode}.`);
    return exitCode;
  }

  const violations = findThresholdViolations(analysis, {
    maxLines,
    maxBytes,
    maxPatterns,
  });

  if (violations.length > 0) {
    console.error('Threshold violations:');
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    return 1;
  }

  return 0;
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  try {
    const exitCode = await runCheckTestOutput();
    process.exit(exitCode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
