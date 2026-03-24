# Workspace Notes Service

Workspace Notes Service is a synthetic monorepo used for long-context benchmark
fixtures. It models a collaborative notes product with:

- an API package that serves session and notes routes,
- a worker package that keeps session snapshots warm, and
- a web package that polls for note updates.

## Packages

- `packages/api`: request handling, auth/session refresh, and permission checks
- `packages/config`: default runtime settings for local and staging deployments
- `packages/worker`: scheduled jobs that precompute session snapshots
- `packages/web`: client-side hooks for polling notes data

## Auth and caching model

The platform revalidates auth state on a rolling window controlled by
`authRefreshWindowSeconds`. Route handlers and the worker use that window to
avoid serving obviously stale membership data.

There are currently two in-memory caches in the API layer:

- `SessionCache`: memoizes expanded session summaries
- `PermissionCache`: memoizes workspace-level access decisions

Historically each cache had its own TTL setting. That made staging flexible, but
it also created incidents where a cache lived longer than the auth refresh
window and preserved stale permissions after role changes.

## Fixture intent

This repository is intentionally documentation-heavy for its size. Benchmark
tasks should require reading both the code and the prose so we can study how the
agent handles long-context navigation, not just single-file edits.
