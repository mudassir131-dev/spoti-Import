# ADR-096: Checkpoint Compaction During Long Running Imports

## Status
Accepted

## Context
Frequent batch commits can cause checkpoint journal files to accumulate redundant state entries during massive imports.

## Decision
Implement automatic state compaction every 500 committed tracks to maintain a single canonical checkpoint snapshot.

## Consequences
- Keeps checkpoint file size under 10KB regardless of import duration.
- Accelerates checkpoint load times upon crash recovery.
