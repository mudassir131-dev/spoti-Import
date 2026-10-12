# ADR-077: Dry-Run Execution Simulation Mode in CLI Import

## Status
Accepted

## Context
Users importing expansive playlists (up to 10,000 tracks) need a risk-free mechanism to preview track resolutions, batch boundaries, and destination paths without mutating the filesystem.

## Decision
Introduce a `--dry-run` flag for `music-import import` that executes full metadata resolution and schema validation while binding a no-op destination adapter.

## Consequences
- Pre-flight verification of rate-limiting, playlist accessibility, and track count ceilings.
- Zero disk I/O side effects during exploratory CLI operations.
