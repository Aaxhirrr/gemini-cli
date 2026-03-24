You are working in the synthetic `local-monorepo` fixture.

The service refreshes auth state every 5 minutes, but the repo still exposes
separate session and permission cache TTL settings. That mismatch lets cached
authorization decisions stay alive longer than the auth data they depend on.

Make `authRefreshWindowSeconds` the single source of truth for cache freshness.

Acceptance criteria:

- `packages/api/src/lib/session-cache.ts` and
  `packages/api/src/lib/permission-cache.ts` both derive cache TTL from
  `authRefreshWindowSeconds`.
- `packages/config/defaults.json`, `packages/api/src/lib/types.ts`, and
  `packages/api/src/server.ts` no longer define or read separate cache TTL
  settings.
- `docs/caching.md` and `docs/architecture.md` explain the invariant clearly.

Constraints:

- Do not change route contracts or business behavior outside cache freshness
  configuration.
- Do not alter the worker cadence or the web polling hook.
- Keep changes limited to the fixture repository.
