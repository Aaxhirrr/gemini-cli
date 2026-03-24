# Long-Context Benchmark Seed Dataset

This directory is the data, schema, and documentation home for the long-context
benchmark subsystem. It is intentionally self-contained so the runner can wire
up against a stable on-disk contract before broader integration lands.

## Layout

- `manifest.json`: top-level manifest for the benchmark dataset.
- `schemas/`: JSON Schemas for the manifest, repository metadata, task specs,
  and run results.
- `repos/<repo-id>/repository.json`: metadata for a benchmark repository plus
  its task directories.
- `repos/<repo-id>/candidate-tasks.md`: curator-facing task extraction notes for
  real repository intake records.
- `repos/<repo-id>/tasks/<task-id>/`: one task per directory with `task.json`,
  `prompt.md`, `curator-notes.md`, and optional validator assets.
- `fixtures/`: local synthetic source trees that tasks operate on.
- `snapshots/`: pinned multi-file extracts from real open-source repositories
  used for lightweight runnable benchmark tasks.

## Seed contents

The initial slice includes one local synthetic monorepo fixture under
`fixtures/local-monorepo` and one cross-file code-change task under
`repos/local-monorepo/tasks/auth-refresh-window`.

The intake corpus also includes real Git-backed repository records for:

- `kubernetes/kubernetes`
- `grafana/grafana`
- `vercel/next.js`
- `apache/airflow`
- `apache/superset`
- `elastic/elasticsearch`
- `apache/kafka`
- `rails/rails`
- `dotnet/aspnetcore`
- `rust-lang/rust`

Each real repository folder also includes:

- one runnable analysis task under `repos/<repo-id>/tasks/`
- one pinned source snapshot under `snapshots/<repo-id>/`
- one `candidate-tasks.md` note with deeper future extraction directions

The real-repo runnable slice currently focuses on architecture-map tasks so the
benchmark can exercise Gemini CLI against real source trees in a lightweight,
repeatable way before deeper code-change task curation is finished.

The task is designed to feel realistic without being huge: it spreads across
docs, config, API code, a worker, and a web hook so future runner work can
exercise long-context navigation rather than isolated single-file edits.

## Runner-facing fields

The seed manifest already models the runner surfaces that the benchmark scripts
consume:

- `supportedRunnerVersion`
- `defaultModelMatrix`
- `shards`
- `curationRubric`

The seed task also demonstrates the runner execution contract:

- `task.execution.timeoutMinutes`
- `task.execution.fakeResponsesFile`
- `task.execution.allowedTools`
- `task.expectedLongContextReasoning`
- `task.acceptanceCriteria`

## Path rules

- Every JSON file carries a `$schema` pointer into `schemas/`.
- Paths inside JSON files are relative to the file that declares them.
- `repository.json` points at either `fixtures/` or `snapshots/`.
- Git-backed repositories can carry a local `fixtureRoot` snapshot for
  reproducible in-repo execution while still preserving the upstream URL and
  pinned commit in `source`.
- `task.json` points at `prompt.md`, `curator-notes.md`, and any optional task
  validator file relative to the task directory.

## Validation model

`TaskSpec.validation` supports these machine-readable hooks:

- `commands`
- `fileAssertions`
- `gitDiff`
- `resultMustContain`
- `validatorFile`

`validatorFile` is optional and is resolved relative to the task directory. The
seed task includes a stub validator so future task scaffolding has a concrete
example to copy.

## Maintainer notes

- Treat fixtures as immutable snapshots. Add new tasks or new fixture roots
  instead of casually mutating shared starting states.
- Real repository intake can happen before deeper task extraction, but the repo
  now also ships a manual `real-repo-analysis` shard with 10 runnable tasks.
- Run `npm run bench:long-context:intake-summary` to generate a markdown and
  JSON summary of the currently onboarded repository corpus.
- Run `npm run bench:long-context:real-repo-analysis` to execute the 10-task
  real-repo shard with deterministic fake responses.
- Keep prompts short and realistic. Put structure in `task.json` and leave the
  prose in `prompt.md`.
- Use only synthetic, sanitized, or public open-source benchmark content here.
- When the task or repository document shape changes, update the matching schema
  and keep `schemaVersion` honest.
- The manifest's `curationRubric` encodes the long-term bar for the dataset.
  During the seed phase the validator reports rubric gaps as warnings rather
  than hard failures so the platform can ship incrementally.
