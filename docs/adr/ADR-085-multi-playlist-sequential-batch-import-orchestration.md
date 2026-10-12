# ADR-085: Multi-Playlist Sequential Batch Import Orchestration

## Status
Accepted

## Context
Users frequently want to back up entire collections consisting of multiple playlist URLs without writing custom shell loops.

## Decision
Permit passing multiple playlist targets to `music-import import`, executing imports sequentially with isolated manifest checkpoints and separate target directories.

## Consequences
- Fault isolation: failure in one playlist does not abort subsequent playlist exports.
- Consistent single-command bulk archival ergonomics.
