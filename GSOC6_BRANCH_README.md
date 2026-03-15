# GSoC 2026 Branch README: Interactive Progress Visualization and Task Stepping

Branch: `gsoc6-progress-20260312`

Commit: `55c162ce7`

This branch packages the work done for the GSoC 2026 proposal around Idea 6,
`Interactive Progress Visualization & Task Stepping`.

The goal of this work is to make Gemini CLI runs feel less like a black box and
more like a debugger-style execution experience inside the Ink terminal UI. The
branch adds a live task tree, step-through approvals, an opt-in inspector for
richer node details, clearer nested failure handling, and user-configurable
trace verbosity controls.

## Why This Branch Exists

The original problem statement for Idea 6 is straightforward: complex multi-step
agent runs are hard to follow in the terminal. Users often see the final answer,
but not the structure of the work that produced it. This branch explores a more
transparent terminal UX where users can:

- see the execution hierarchy while a task is still running
- step through approvals with full context
- inspect individual nodes instead of reading disconnected logs
- understand nested failures in-place
- tune trace density depending on what they want to inspect

This is a proposal branch, not an upstream-ready product branch. The emphasis
here is on demonstrating the UX direction, validating the interaction model, and
showing a realistic implementation path in the existing codebase.

## Expected Outcomes Covered

| Expected outcome                                                               | Status in this branch | Notes                                                                    |
| ------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------ |
| Real-time task tree visualization in the Ink TUI                               | Implemented           | Live execution tree with task, decision, subagent, and tool hierarchy    |
| Step-through mode where users approve individual tool calls or agent decisions | Implemented           | Keyboard-driven step mode with clearer priority than the trace inspector |
| Rich-text rendering of tool inputs/outputs with collapsible sections           | Implemented           | Inspector-based details with compact and expanded modes                  |
| Improved error state visualization for nested agent failures                   | Implemented           | Failure path stays localized to the correct branch and node              |
| User-configurable verbosity levels for different task categories               | Implemented           | Global verbosity plus per-category overrides and CLI flags               |

## Validation Status

The implementation in this branch was validated locally with:

- focused trace/config UI test suite
- `npm run typecheck --workspace @google/gemini-cli`
- `npm run build --workspace @google/gemini-cli`

A representative test run used:

```bash
npm run test --workspace @google/gemini-cli -- src/config/config.test.ts src/config/settingsSchema.test.ts src/ui/components/MainContent.traceFocus.test.tsx src/ui/components/trace/TraceTree.test.tsx src/ui/components/trace/StepActionBar.test.tsx src/ui/components/trace/traceVerbosity.test.ts src/ui/components/Composer.test.tsx
```

## Screenshot Overview

For proposal clarity, the branch is documented with screenshots captured from
the working implementation. A live recording was intentionally not used as the
primary artifact because standard scrollback rendering still flickers in some
terminal environments during heavy live updates.

### Demo 1: Real-Time Task Tree Visualization

![Demo 1: Live task tree](./docs/assets/gsoc6/demo-1-live-task-tree.png)

Caption: Real-time task tree visualization showing the hierarchy of work as the
agent executes a multi-step task.

### Demo 2: Step-Through Mode

![Demo 2: Step-through approval](./docs/assets/gsoc6/demo-2-step-through.png)

Caption: Step-through mode pauses execution at an actionable step and lets the
user explicitly choose how to proceed while keeping the task trace visible.

### Demo 3: Inspector and Collapsible Detail Rendering

![Demo 3: Inspector](./docs/assets/gsoc6/demo-3-inspector.png)

Caption: Inspector view rendering structured details for the selected execution
node without flooding the main trace.

### Demo 4: Nested Failure Visualization

![Demo 4: Nested failure](./docs/assets/gsoc6/demo-4-nested-failure.png)

Caption: Nested failure localized to the correct branch and node, with
surrounding task context preserved.

### Demo 5: Verbosity Controls

<table>
  <tr>
    <td align="center"><strong>Quiet</strong></td>
    <td align="center"><strong>Standard</strong></td>
    <td align="center"><strong>Verbose</strong></td>
    <td align="center"><strong>Debug</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/assets/gsoc6/demo-5-quiet.png" alt="Quiet mode" width="240"></td>
    <td><img src="./docs/assets/gsoc6/demo-5-standard.png" alt="Standard mode" width="240"></td>
    <td><img src="./docs/assets/gsoc6/demo-5-verbose.png" alt="Verbose mode" width="240"></td>
    <td><img src="./docs/assets/gsoc6/demo-5-debug.png" alt="Debug mode" width="240"></td>
  </tr>
</table>

Caption: The same task rendered at four global verbosity levels, demonstrating
progressively richer execution detail.

## How To Run This Branch

From the repository root:

```bash
npm install
npm run build --workspace @google/gemini-cli
npm run start -- --help
```

Important note: in this local development setup, `gemini --help` may fail if the
global install points at a missing bundle. For this branch, use
`npm run start -- ...` commands from the repo root.

### Trace-Related CLI Flags Added or Used In This Branch

```text
--step
--trace-verbosity
--trace-task-verbosity
--trace-decision-verbosity
--trace-subagent-verbosity
--trace-tool-verbosity
--trace-inspector
```

To inspect the local help output:

```bash
npm run start -- --help
```

## Demo Guide

The sections below are the exact commands and prompts used to demonstrate each
expected outcome.

### Demo 1: Real-Time Task Tree Visualization

Command:

```bash
npm run start -- --trace-verbosity standard
```

Prompt:

```text
Explain how config flows from `packages/cli/src/gemini.tsx` to `packages/cli/src/config/config.ts` and then into `packages/core/src/config/config.ts`. Read only what is necessary and do not modify anything.
```

What to look for:

- the root task stays visible while the run is active
- major branches form under the task in real time
- tool calls appear under the correct branch instead of as an unstructured log
- status changes are visible while execution is still in progress

### Demo 2: Step-Through Mode

Command:

```bash
npm run start -- --step --trace-verbosity standard
```

Prompt:

```text
Analyze configuration loading in this repo. Trace the CLI path, core config path, and settings schema. Do not modify anything.
```

What to look for:

- the run pauses on actionable steps
- `Action Required` remains visible with the trace tree still on screen
- `Enter` executes the current step in step mode
- the trace does not steal the step confirmation keys during the demo

### Demo 3: Inspector and Rich Detail Rendering

Command:

```bash
npm run start -- --trace-verbosity standard --trace-inspector
```

Prompt:

```text
Analyze configuration loading in this repo. Trace the CLI path, core config path, and settings schema. Do not modify anything.
```

What to look for:

- `Up` and `Down` move selection through the trace tree
- `Enter` opens the inspector for the selected node
- `Ctrl+O` toggles between compact and expanded inspector detail
- inputs, outputs, metadata, and hidden-line summaries stay attached to the
  selected node

### Demo 4: Nested Failure Visualization

Command:

```bash
npm run start -- --trace-verbosity standard
```

Prompt:

```text
Analyze configuration loading across this repo. Break the work into three branches: trace the CLI config entrypoints, trace the core config lifecycle, and inspect `packages/core/src/config/definitely-missing.ts` for `class Config`. Use that missing path exactly as written. Do not correct it. Treat that failure as non-fatal and continue the other branches. Do not modify anything.
```

What to look for:

- the failure is attached to the exact branch that owns it
- successful sibling branches remain successful
- the failure path is readable without a generic catch-all banner
- the selected failed node can still be inspected after completion

### Demo 5: Verbosity Controls

Global verbosity commands:

```bash
npm run start -- --trace-verbosity quiet
npm run start -- --trace-verbosity standard
npm run start -- --trace-verbosity verbose
npm run start -- --trace-verbosity debug
```

Suggested prompt:

```text
Trace the configuration startup path from `packages/cli/src/gemini.tsx` into `packages/cli/src/config/config.ts` and `packages/core/src/config/config.ts`. Read only 4-6 essential files, summarize the flow briefly, and do not modify anything.
```

Optional category-specific override example:

```bash
npm run start -- --trace-verbosity quiet --trace-tool-verbosity verbose
```

What to look for:

- quiet mode keeps the tree compact
- standard mode shows a balanced default view
- verbose mode expands execution detail
- debug mode surfaces the densest internal trace detail
- category overrides can increase detail for one node type without globally
  promoting everything else

## What Changed In The UI

This branch is more than a screenshot layer. It changes how the CLI organizes,
filters, and interacts with trace data.

### 1. Presentation Tree Layer

The raw trace data is transformed into a more readable presentation tree so
users see meaningful branches instead of a flat series of tool calls.

Key files:

- `packages/cli/src/ui/components/trace/presentationTree.ts`
- `packages/cli/src/ui/components/trace/TraceTree.tsx`
- `packages/cli/src/ui/components/trace/TraceNodeRow.tsx`

### 2. Keyboard Focus and Step Control

Action-required controls and trace navigation were separated so step mode can
own `Enter` and approval keys without inspector interference.

Key files:

- `packages/cli/src/ui/components/MainContent.tsx`
- `packages/cli/src/ui/components/ToolConfirmationQueue.tsx`
- `packages/cli/src/ui/components/trace/StepActionBar.tsx`

### 3. Inspector and Detail Rendering

A dedicated inspector panel was added for rich node details. For demo clarity,
the inspector is disabled by default and enabled explicitly with
`--trace-inspector`.

Key files:

- `packages/cli/src/ui/components/trace/TraceTree.tsx`
- `packages/cli/src/ui/components/trace/TraceNodeDetails.tsx`
- `packages/cli/src/ui/components/MainContent.tsx`

### 4. Failure-Oriented Trace Behavior

Trace status propagation and visibility rules were adjusted so nested failures
remain localized and understandable.

Key files:

- `packages/cli/src/ui/components/trace/traceVerbosity.ts`
- `packages/cli/src/ui/components/MainContent.tsx`
- `packages/cli/src/ui/components/trace/TraceTree.tsx`

### 5. Configurable Verbosity

The branch adds both configuration-backed and CLI-backed trace verbosity
controls, including per-category overrides.

Key files:

- `packages/cli/src/config/settingsSchema.ts`
- `packages/cli/src/config/config.ts`
- `packages/cli/src/ui/components/trace/traceVerbosity.ts`

## Limitations and Known Issues

This branch is intentionally honest about what is still rough.

### 1. Standard Scrollback Flicker Is Not Fully Solved

The biggest remaining issue is terminal flicker in some environments during
heavy live updates, especially in the lower prompt or status region while the
trace is actively changing. This is the main reason the proposal package is
documented with screenshots rather than relying entirely on video.

### 2. Inspector Is Opt-In For Demo Clarity

The inspector is intentionally disabled by default in standard mode for Demo 1
and Demo 2, and enabled explicitly with `--trace-inspector` for Demo 3. This
keeps the proposal demos separated by expected outcome, but it is not
necessarily the final product behavior.

### 3. Presentation Labels Still Use Heuristics

The presentation tree improves readability, but some branch naming is still
heuristic. That means the system is useful and demonstrable, but not yet a fully
general semantic summarizer for every possible task wording.

### 4. Global Development Entry Point Is Preferred

In this environment, the repository-local command path is the reliable one:

```bash
npm run start -- ...
```

A broken global `gemini` install can point at a missing bundle and fail even
when the local branch works correctly.

### 5. The Branch Is Proposal-Oriented, Not Final Product Polish

The core interaction model is here and working, but there is still polish work
left around terminal rendering stability, documentation cleanup, and shaping the
exact upstream UX defaults.

## Suggested Follow-Up Work

If this branch were continued beyond the proposal stage, the next priorities
would be:

- isolate and fix the remaining standard scrollback flicker in the lower
  terminal region
- harden the presentation tree heuristics and fallback labeling
- decide the final product default for inspector availability
- improve documentation for the new trace flags in the public configuration docs
- reduce visual churn in large live traces and long-running sessions

## Quick Command Reference

```bash
# Local help
npm run start -- --help

# Demo 1
npm run start -- --trace-verbosity standard

# Demo 2
npm run start -- --step --trace-verbosity standard

# Demo 3
npm run start -- --trace-verbosity standard --trace-inspector

# Demo 4
npm run start -- --trace-verbosity standard

# Demo 5
npm run start -- --trace-verbosity quiet
npm run start -- --trace-verbosity standard
npm run start -- --trace-verbosity verbose
npm run start -- --trace-verbosity debug
```

## Final Notes

This branch is meant to make the proposal concrete. It does not just describe
the five expected outcomes in abstract terms; it implements them in the existing
Gemini CLI UI stack, validates them with tests, and documents them with
reproducible commands and screenshots.

For proposal review, the screenshots in this document are the cleanest summary
artifact. For deeper inspection, the branch itself contains the implementation,
tests, and CLI flags needed to rerun the demos locally.
