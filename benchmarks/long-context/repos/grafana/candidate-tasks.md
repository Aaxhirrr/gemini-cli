# Candidate Tasks

Task status: intake candidate only. No runnable benchmark task has been extracted yet.

## Candidate 1: Reconcile permission or feature-toggle behavior across backend and frontend

- Why this is long-context: candidate fixes should cut across Go backend authorization logic, provisioning or config defaults, TypeScript UI behavior, and product docs.
- Likely components: `pkg/`, `packages/`, `public/app/`, `conf/`, docs under `docs/sources/`.
- Validation direction: backend tests, frontend snapshots or unit tests, and a docs assertion that the shared behavior is explained consistently.

