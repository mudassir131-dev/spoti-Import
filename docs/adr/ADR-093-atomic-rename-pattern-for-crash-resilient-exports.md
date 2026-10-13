# ADR-093: Atomic Rename Pattern for Crash Resilient Exports

## Status
Accepted

## Context
If a CLI process is killed midway through export execution, an incomplete destination file could masquerade as a successful export.

## Decision
All file exporters write output to temporary filenames and perform an atomic filesystem rename only after successful stream flush.

## Consequences
- Ensures target export files are always 100% complete or do not exist.
- Prevents corrupt data files from entering production ingestion pipelines.
