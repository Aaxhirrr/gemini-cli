# Curator Notes

## Why this task exists

This task is the seed long-context example for a realistic cross-file edit: docs
describe the right freshness invariant, config still exposes legacy TTL knobs,
and the API cache factories consume those older settings.

An agent has to read prose plus code to complete it cleanly.

## Expected touch points

- `docs/architecture.md`
- `docs/caching.md`
- `packages/config/defaults.json`
- `packages/api/src/lib/types.ts`
- `packages/api/src/lib/session-cache.ts`
- `packages/api/src/lib/permission-cache.ts`
- `packages/api/src/server.ts`

## Files that should stay untouched

- `packages/api/src/routes/sessions.ts`
- `packages/api/src/routes/notes.ts`
- `packages/web/src/hooks/useWorkspaceNotes.ts`
- `packages/worker/src/jobs/sessionSnapshot.ts`

## Validation notes

`task.json` demonstrates all current validation surfaces:

- command-based checks
- file assertions
- git diff expectations
- result text expectations
- `validation.validatorFile`

`validator.js` adds one task-specific guard on top of the declarative checks: it
verifies that the updated docs explicitly describe the single cache freshness
budget.
