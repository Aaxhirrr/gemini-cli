# GSoC 2026 Discussion Post Draft

**Suggested title:** GSoC 2026 Proposal: Interactive Progress Visualization &
Task Stepping for Gemini CLI

Hi everyone,

I am preparing a GSoC 2026 proposal around **Idea 6: Interactive Progress
Visualization & Task Stepping** for Gemini CLI.

The core motivation behind this proposal is that complex Gemini CLI runs can
still feel like a black box in the terminal. Users often get the final answer,
but they do not always get a clear, structured sense of what the agent is doing
while it works through a multi-step task. My proposal focuses on making that
process more visible, inspectable, and interactive directly inside the existing
Ink-based terminal UI.

I put together a working prototype branch for this idea and documented it with a
dedicated branch README that includes the implementation summary, demo commands,
screenshots for each expected outcome, and current limitations.

**Branch:**

- https://github.com/Aaxhirrr/gemini-cli/tree/gsoc6-progress-20260312

**Proposal branch README with screenshots and demo guide:**

- https://github.com/Aaxhirrr/gemini-cli/blob/gsoc6-progress-20260312/GSOC6_BRANCH_README.md

Rather than putting a large screenshot dump directly into this discussion post,
I kept the post focused and linked the full branch README above, where the
screenshots and demo walkthroughs are organized by expected outcome.

## What the prototype in this branch covers

This branch is built around the five expected outcomes listed in the project
idea:

1. **Real-time task tree visualization in the Ink TUI**
   - The CLI renders a live execution tree while a task is still running.
   - Instead of a flat stream of tool calls and thoughts, work is grouped into a
     hierarchy of task, decision, subagent, and tool nodes.

2. **Step-through mode where users approve individual tool calls or agent
   decisions**
   - The branch includes a step mode that pauses before execution and lets the
     user explicitly continue through the run.
   - The trace stays visible while approval is happening, so the user is not
     making a decision in a disconnected confirmation prompt.

3. **Rich-text rendering of tool inputs/outputs with collapsible sections**
   - I added an inspector-based detail view for trace nodes.
   - This makes it possible to select a node and inspect inputs, outputs,
     metadata, and truncated sections in a more structured way.

4. **Improved error state visualization for nested agent failures**
   - Failure paths stay attached to the correct branch rather than surfacing as
     generic terminal noise.
   - This helps make nested tool or subagent failures feel more like debugger
     breakpoints than stray errors.

5. **User-configurable verbosity levels for different task categories**
   - The branch supports global trace verbosity (`quiet`, `standard`, `verbose`,
     `debug`).
   - It also supports category-specific overrides through CLI flags for task,
     decision, subagent, and tool nodes.

## Why I think this is a good GSoC project

I think this project is strong because it sits right at the intersection of:

- real terminal UX problems
- asynchronous UI state management in Ink
- rendering and interaction challenges under live updates
- meaningful improvements to user trust and control

It is not just about making the interface look nicer. It is about giving users
better mental models of what the agent is doing, when it is blocked, when it is
failing, and when they should intervene.

## Optional local demo

If anyone wants to run the prototype locally, the branch README contains a full
demo guide. A few representative commands are:

```bash
# local help for the branch
npm run start -- --help

# Demo 1: real-time task tree
npm run start -- --trace-verbosity standard

# Demo 2: step-through mode
npm run start -- --step --trace-verbosity standard

# Demo 3: inspector/details
npm run start -- --trace-verbosity standard --trace-inspector

# Demo 5: verbosity comparison
npm run start -- --trace-verbosity quiet
npm run start -- --trace-verbosity standard
npm run start -- --trace-verbosity verbose
npm run start -- --trace-verbosity debug
```

The branch README includes the prompts I used for each demo and the screenshots
for all five expected outcomes.

## Current limitations

I also want to be honest about what is still rough in the prototype.

The main unresolved issue is **terminal flicker in standard scrollback mode
under heavy live updates**, especially around the lower prompt/status area in
some environments. Because of that, I chose to document the proposal primarily
with screenshots in the branch README rather than relying on a polished live
recording.

There are also places where the presentation tree still uses heuristics for
branch naming. That is acceptable for a prototype and proposal branch, but it is
not yet the final form of a fully general trace summarization system.

## What I would like feedback on

I would especially appreciate feedback on:

- whether this direction fits the spirit of Idea 6 well
- whether the five expected outcomes are being interpreted correctly
- whether the proposed demo breakdown is a strong way to present the work
- which parts feel most valuable to prioritize if the project moves forward

If it is helpful, I can also follow up with a more implementation-focused
breakdown, but I wanted this post to stay focused on the prototype branch, the
proposal mapping, and the user-facing UX direction.

Thanks.
