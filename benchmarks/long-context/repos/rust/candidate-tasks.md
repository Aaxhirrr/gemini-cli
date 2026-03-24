# Candidate Tasks

Task status: intake candidate only. No runnable benchmark task has been extracted yet.

## Candidate 1: Preserve a diagnostics or configuration invariant across compiler phases

- Why this is long-context: strong Rust candidates require tracing behavior from parsing or lowering into later compiler passes, diagnostics output, UI tests, and reference docs.
- Likely components: `compiler/`, `library/` when standard library interactions matter, `src/tools/`, UI tests under `tests/ui/`, and documentation under `src/doc/`.
- Validation direction: UI tests or compiler unit tests plus docs or error-message assertions that capture the intended invariant.
