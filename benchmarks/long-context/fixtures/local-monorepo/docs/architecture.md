# Architecture Notes

## Request flow

1. `packages/api/src/server.ts` loads config from `packages/config/defaults.json`
   and environment overrides.
2. Session routes build a `SessionSummary` for the caller and reuse the
   in-memory session cache when possible.
3. Notes routes derive workspace permissions from the current session summary
   and memoize the resulting access decision.
4. The worker precomputes session snapshots so the API can hydrate summaries
   quickly during traffic spikes.

## Freshness invariant

Authorization data is only trustworthy for the same window as the auth refresh
cycle. If caches survive longer than `authRefreshWindowSeconds`, a user can keep
stale workspace access after membership changes even though the next refresh
would have revoked it.

For that reason, the intended architecture is:

- worker snapshot cadence can match the refresh window,
- session summaries can be reused only inside the refresh window,
- permission decisions must never outlive the session data they depend on.

The fixture currently violates the last two bullets because the cache TTLs are
configurable independently from the auth refresh window.

## Non-goals

- The web poll interval should stay independent from cache internals.
- Route contracts should not need to change for cache freshness fixes.
- The worker should continue to call into the same session service methods.
