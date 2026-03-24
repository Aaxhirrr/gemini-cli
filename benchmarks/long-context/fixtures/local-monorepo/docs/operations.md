# Operations Notes

## Staging defaults

The synthetic staging profile uses a five-minute auth refresh window and keeps
API caches warm aggressively because the notes UI polls often.

## Incident summary: INC-2041

- Symptom: users retained stale write access after being downgraded from editor
  to viewer in a workspace.
- Detection: a support replay showed note updates succeeding for several
  minutes after the next auth refresh should have revoked access.
- Root cause: cache TTLs were tuned separately from the auth refresh window and
  the permission cache outlived both the refresh cycle and the session cache.
- Follow-up: collapse freshness control onto the auth refresh window and
  document the invariant near config loading.

## Guardrails

- Avoid using cache-specific environment variables when the cache represents
  auth-derived state.
- Prefer one freshness setting over multiple knobs that can drift apart.
