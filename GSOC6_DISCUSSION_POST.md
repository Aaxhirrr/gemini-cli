# PoC Branch Submission (Open for Discussion)

**Suggested title:** PoC Branch Submission (Open for Discussion): GSoC Idea 6 -
Interactive Progress Visualization & Task Stepping

Hi everyone, Aashir here,

I wanted to share my **proof-of-concept branch** for **GSoC Idea 6: Interactive
Progress Visualization & Task Stepping** in Gemini CLI.

This is **not intended as a merge-ready final patch**. I am sharing it early so
I can get feedback on the overall direction, scope, interaction model, and how
well this approach matches the expected outcomes for the project idea.

I integrated the work directly into the Gemini CLI codebase rather than building
it as a separate mock app, because I wanted to validate that these ideas can
work end-to-end inside the existing Ink terminal UI and real CLI workflows.

I know this is **far from perfect right now**. There are still rough edges, and
I am treating this as a proposal-style validation branch rather than a finished
implementation.

I have already contributed to `gemini-cli`, and I would really love the chance
to work on this officially through GSoC, iterate with maintainer feedback, and
help push it toward a production-quality state.

## What I'm Demonstrating

- Real-time task tree visualization in the Ink TUI
- Step-through mode for pausing and approving actions during execution
- Inspector-based rendering for richer tool inputs, outputs, and metadata
- Improved nested failure visibility inside the execution tree
- User-configurable trace verbosity levels for different execution views

## Links

- PoC branch:
  https://github.com/Aaxhirrr/gemini-cli/tree/gsoc6-progress-20260312
- Branch README with screenshots + demo guide:
  https://github.com/Aaxhirrr/gemini-cli/blob/gsoc6-progress-20260312/GSOC6_BRANCH_README.md
- Discussion draft source in branch:
  https://github.com/Aaxhirrr/gemini-cli/blob/gsoc6-progress-20260312/GSOC6_DISCUSSION_POST.md

Instead of embedding a large screenshot dump directly in this discussion post, I
kept the screenshots and full walkthrough in the branch README above so
everything stays organized in one place.

## How To Try The Branch

If anyone wants to run the PoC locally, the shortest path is:

```bash
git clone --branch gsoc6-progress-20260312 --single-branch https://github.com/Aaxhirrr/gemini-cli.git
cd gemini-cli
npm install
npm run build --workspace @google/gemini-cli
```

If someone already has a local checkout, they can fetch the branch instead:

```bash
git remote add aaxhirrr https://github.com/Aaxhirrr/gemini-cli.git
git fetch aaxhirrr gsoc6-progress-20260312
git checkout -b gsoc6-progress-20260312 aaxhirrr/gsoc6-progress-20260312
```

## Quick Demo Commands

From the repo root:

```bash
npm run start -- --help

# Demo 1: live task tree
npm run start -- --trace-verbosity standard

# Demo 2: step-through mode
npm run start -- --step --trace-verbosity standard

# Demo 3: inspector/details
npm run start -- --trace-verbosity standard --trace-inspector

# Demo 4: nested failure path
npm run start -- --trace-verbosity standard

# Demo 5: verbosity comparison
npm run start -- --trace-verbosity quiet
npm run start -- --trace-verbosity standard
npm run start -- --trace-verbosity verbose
npm run start -- --trace-verbosity debug
```

The exact prompts used for each demo are listed in the branch README.

## Important Note

I know the diff is large, but this is intentionally a **proposal-style PoC
branch**. The goal here is to validate the UX direction and prove that these
interaction patterns can work inside the existing CLI, not to present a final
polished upstream patch.

The main known limitation right now is **terminal flicker in standard scrollback
mode** under heavy live updates, especially around the lower prompt/status area
in some environments. That is the main reason I chose to document this branch
primarily through the README screenshots instead of a polished video demo.

I am very open to guidance on how this should be scoped, split, or restructured
if the direction itself seems useful.

## Quick Intro

- I'm **Aashir Javed**, a Computer Science student at **Arizona State
  University**.
- I am applying for **Google Summer of Code 2026** and focused this PoC on
  Gemini CLI UX/UI work.
- My core stack is **Python, TypeScript, React, Node.js, FastAPI, AWS/GCP,
  Docker, and LLM systems**.
- I have already been contributing to `gemini-cli`, and I want this branch to
  show both proposal seriousness and real codebase understanding.

## Feedback I'm Looking For

- Does this direction fit the spirit of Idea 6 well?
- Does the demo breakdown map cleanly to the five expected outcomes?
- Which parts feel most valuable to prioritize if this moves forward?
- Are there places where the current interaction model should be simplified?

Excited for any feedback, from maintainers and contributors alike. Feel free to
be blunt about scope, UX tradeoffs, or architecture concerns.

Thanks for taking a look.
