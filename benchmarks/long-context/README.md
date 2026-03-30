# Long-Context Benchmark Platform

This directory is the data, schema, runner contract, and documentation home for
the long-context benchmark work on the
`feature/long-context-benchmark-platform` branch.

The goal of this branch is to turn the original seed benchmark idea into a
working proof of concept for repository-scale coding evaluation inside
Gemini CLI.

## What This Branch Adds

This branch expands the benchmark work from a small seed concept into a broader
platform that already includes:

- a benchmark manifest and schema contract
- repository metadata and task manifests
- dataset validation and repository checking scripts
- benchmark execution and aggregation scripts
- one end-to-end synthetic code-change task
- ten runnable real-repository analysis tasks over pinned open-source snapshots
- a CLI-native `/benchmark` dashboard for inspection and demo purposes

In other words, this branch is no longer just a seed dataset stub. It is a
working benchmark platform with real intake, runnable lanes, reporting, and a
demo surface inside Gemini CLI.

## Current Snapshot

At the current branch snapshot, the benchmark prototype includes:

- `11` repositories total
- `11` runnable tasks total
- `10` real pinned open-source repositories
- `1` synthetic local fixture repository
- `1` smoke lane
- `1` real-repository analysis lane with `10` runnable tasks

The current long-term curation rubric encoded in
[`manifest.json`](./manifest.json) is:

- minimum repositories: `30`
- target repositories: `50`

This means the platform is already functional, but the dataset is still below
the long-term curation target and should be treated as a proof of concept plus
early intake corpus rather than a finished benchmark.

## Repository Coverage

### Synthetic Seed Repository

- `local-monorepo`

### Real Pinned Open-Source Repositories

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

### Current Language Coverage

The current prototype already spans:

- TypeScript
- JavaScript
- Go
- Python
- Java
- Scala
- Ruby
- C#
- Rust
- JSON
- Markdown

## What Exists Today

### 1. Dataset and Schema Layer

The benchmark ships with a stable on-disk contract for:

- the top-level benchmark manifest
- repository metadata
- task metadata
- validation definitions
- run results

This makes the benchmark portable and easier to evolve without tying every
change directly to runner internals.

### 2. Runnable Seed Task

The synthetic `local-monorepo` fixture contains the first end-to-end benchmark
task:

- `local-monorepo/auth-refresh-window`

This task is a real multi-file change task that touches application code,
configuration, and documentation. It exists to prove that the benchmark can
exercise coordinated long-context edits instead of only isolated single-file
checks.

### 3. Runnable Real-Repository Lane

The branch also ships a manual `real-repo-analysis` shard with ten runnable
tasks over pinned snapshots from real repositories:

- `kubernetes/apiserver-startup-map`
- `grafana/grafana-startup-map`
- `nextjs/next-dev-config-map`
- `airflow/scheduler-config-map`
- `superset/bootstrap-config-map`
- `elasticsearch/node-bootstrap-map`
- `kafka/broker-startup-map`
- `rails/rails-boot-map`
- `aspnetcore/hosting-auth-map`
- `rust/rustc-startup-map`

These tasks currently focus on architecture-map style analysis so the benchmark
can already test repository-scale understanding in a lightweight and repeatable
way before deeper real-repo code-change task curation is complete.

### 4. Benchmark Scripts

The current benchmark flow already supports:

- dataset validation
- repository intake summaries
- repository hygiene checks
- benchmark execution
- run aggregation

Available scripts include:

- `npm run bench:long-context:validate-dataset`
- `npm run bench:long-context:check-repo`
- `npm run bench:long-context:intake-summary`
- `npm run bench:long-context:run`
- `npm run bench:long-context:aggregate-results`
- `npm run bench:long-context:smoke`
- `npm run bench:long-context:real-repo-analysis`

### 5. CLI-Native Benchmark Dashboard

The branch also includes a native `/benchmark` command in Gemini CLI.

This dashboard is mainly a development and demo surface. It helps make the
benchmark easier to inspect locally by showing:

- dataset summary
- latest run summary
- task-level results
- benchmark transcript output
- repository coverage cards

This is helpful for proposal demos and developer ergonomics, but the core work
of the branch is still the benchmark platform itself.

## Directory Layout

- `manifest.json`: top-level benchmark manifest
- `schemas/`: JSON schemas for dataset and result files
- `repos/<repo-id>/repository.json`: repository metadata and task inventory
- `repos/<repo-id>/candidate-tasks.md`: curator-facing extraction notes
- `repos/<repo-id>/tasks/<task-id>/`: task directory with prompt, task spec,
  notes, and validator assets
- `fixtures/`: synthetic local fixture repositories
- `snapshots/`: pinned source extracts from real open-source repositories

## What The Proof Of Concept Demonstrates

This branch already demonstrates that Gemini CLI can host a long-context
benchmark workflow that includes:

- curated repository intake
- stable schema-driven benchmark data
- runnable benchmark tasks
- structured validation
- repeatable benchmark lanes
- aggregated run reporting
- CLI-native benchmark inspection

This matters because it reduces the risk of the broader GSoC project. The
benchmark platform is not starting from zero anymore.

## What It Does Not Yet Fully Solve

This branch is still an early platform milestone, not the final benchmark.

Important current limits:

- the dataset is still below the `30-50` repository target encoded in the
  curation rubric
- the real-repository lane currently uses lightweight architecture-map tasks
  rather than deeper code-change tasks across full cloned repositories
- the demoable real-repository lane currently runs with deterministic fake
  responses for repeatability
- richer failure analysis and broader task coverage are still future work

So the current claim is:

- this branch proves the platform works
- this branch proves the benchmark can already be demoed end-to-end
- this branch does **not** claim the long-context dataset is already complete

## Quick Local Demo

From a fresh local checkout:

```bash
git clone https://github.com/Aaxhirrr/gemini-cli.git
cd gemini-cli
git checkout feature/long-context-benchmark-platform
npm install
npm run build:packages
```

### Terminal Demo

Run the current intake summary:

```bash
npm run bench:long-context:intake-summary
```

Run the seed smoke lane:

```bash
npm run bench:long-context:smoke
```

Run the real-repository analysis lane:

```bash
npm run bench:long-context:real-repo-analysis
```

### Gemini CLI Demo

Start the CLI:

```bash
node packages/cli/dist/index.js
```

Inside Gemini CLI, use:

```text
/benchmark report
/benchmark run real
/benchmark run smoke
```

## Generated Artifacts

Benchmark scripts currently write artifacts under:

- `artifacts/long-context-benchmark/dataset-validation.json`
- `artifacts/long-context-benchmark/repo-check.json`
- `artifacts/long-context-benchmark/last-run-summary.json`
- `artifacts/long-context-benchmark/aggregate-summary.json`
- `artifacts/long-context-benchmark/aggregate-summary.md`
- `artifacts/long-context-benchmark/intake-summary.json`
- `artifacts/long-context-benchmark/intake-summary.md`
- `artifacts/long-context-benchmark/runs/`

These make it easier to inspect and compare results without reading raw task
output by hand.

## Important Files

If you want to understand the branch quickly, these are the most useful entry
points:

- [`manifest.json`](./manifest.json)
- [`repos/local-monorepo/tasks/auth-refresh-window/task.json`](./repos/local-monorepo/tasks/auth-refresh-window/task.json)
- [`repos/local-monorepo/tasks/auth-refresh-window/prompt.md`](./repos/local-monorepo/tasks/auth-refresh-window/prompt.md)
- [`task-validators/architecture-map.js`](./task-validators/architecture-map.js)
- [`../../scripts/benchmarks/long-context/run.ts`](../../scripts/benchmarks/long-context/run.ts)
- [`../../packages/cli/src/ui/commands/benchmarkCommand.ts`](../../packages/cli/src/ui/commands/benchmarkCommand.ts)

## Maintainer Notes

- treat fixtures and pinned snapshots as benchmark starting states
- add new tasks or new snapshot roots instead of casually mutating shared task
  baselines
- keep prompts realistic and keep structure in `task.json`
- use only public, synthetic, or sanitized benchmark data
- when task or repository document shape changes, update the matching schema
- keep `schemaVersion` and manifest metadata honest as the dataset evolves

## Next Steps

The next milestone after this branch is to keep pushing the platform toward the
full long-context benchmark vision:

- expand repository coverage toward the rubric target
- curate more runnable tasks per repository
- move deeper into real-repo code-change tasks
- improve failure categorization and reporting
- continue hardening the benchmark workflow inside Gemini CLI

That work is still ahead, but this branch already establishes the core platform,
the first runnable seed task, the first real-repo shard, and a working local
demo path.
