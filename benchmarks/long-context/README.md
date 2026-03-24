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

## Seed contents

The initial slice includes one local synthetic monorepo fixture under
`fixtures/local-monorepo` and one cross-file task under
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

Each real repository folder also includes a `candidate-tasks.md` note with one
initial long-context extraction direction to guide future task curation.

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
- `repository.json` points at the fixture root under `fixtures/`.
- Git-backed repositories can omit `fixtureRoot` during intake and rely on
  `source.kind = "git"` with a pinned remote commit until task extraction
  begins.
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
- Real repository intake can happen before task extraction. Repositories with no
  tasks are metadata-only onboarding records and are intentionally excluded from
  smoke validation unless explicitly targeted.
- Run `npm run bench:long-context:intake-summary` to generate a markdown and
  JSON summary of the currently onboarded repository corpus.
- Keep prompts short and realistic. Put structure in `task.json` and leave the
  prose in `prompt.md`.
- Use only synthetic or sanitized content here. Do not copy production
  repositories or datasets.
- When the task or repository document shape changes, update the matching schema
  and keep `schemaVersion` honest.
- The manifest's `curationRubric` encodes the long-term bar for the dataset.
  During the seed phase the validator reports rubric gaps as warnings rather
  than hard failures so the platform can ship incrementally.
