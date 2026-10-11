# ADR-065: Track Count Limiting Ceiling via CLI Flags

## Status
Accepted

## Context
Testing or partial imports often require ingesting only a subset of playlist tracks rather than the entire collection.

## Decision
Provide the `--limit` (`-l`) flag on the `import` command, bounded between 1 and the domain ceiling of 10,000 tracks.

## Consequences
- Quick sampling and debugging in production environments.
- Enforces strict safety clamping at the 10,000 maximum track limit.
