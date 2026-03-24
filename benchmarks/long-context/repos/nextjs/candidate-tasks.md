# Candidate Tasks

Task status: intake candidate only. No runnable benchmark task has been extracted yet.

## Candidate 1: Fix config precedence drift between App Router runtime and build tooling

- Why this is long-context: realistic fixes would touch router config parsing, compiler or bundler behavior, dev server execution, and the public docs that define precedence rules.
- Likely components: `packages/next/`, `packages/next/src/server/`, `packages/next/src/build/`, `docs/`, and selected `crates/` paths when Rust-side plumbing is involved.
- Validation direction: integration tests under the Next.js test suites plus documentation updates capturing the final precedence contract.

