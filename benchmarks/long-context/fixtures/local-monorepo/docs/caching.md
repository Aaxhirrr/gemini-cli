# Caching Guide

## Current caches

### Session cache

- Owner: API package
- Purpose: avoid rebuilding the same `SessionSummary` repeatedly during bursty
  traffic
- Current TTL source: `sessionCacheTtlSeconds`

### Permission cache

- Owner: API package
- Purpose: avoid recomputing workspace access checks for repeated note requests
- Current TTL source: `permissionCacheTtlSeconds`

## Why this is risky

The auth system refreshes every `authRefreshWindowSeconds`. If either cache uses
a longer TTL, the API can continue serving an access decision that no longer
matches the user's latest workspace membership.

That exact shape caused incident `INC-2041` in staging:

- auth refresh window: 300 seconds
- session cache TTL: 600 seconds
- permission cache TTL: 900 seconds

After a workspace downgrade, cached write access survived for up to 15 minutes.

## Desired end state

- One freshness budget: `authRefreshWindowSeconds`
- Session cache TTL derived from that budget
- Permission cache TTL derived from that budget
- Docs and config naming that make the invariant obvious to future maintainers
