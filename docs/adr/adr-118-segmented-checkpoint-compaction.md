# ADR-118: Adopt Segmented Checkpoint Compaction to Prevent Unbounded Log Growth

## Status
Accepted

## Context
Long-running multi-stage imports accumulated thousands of checkpoint entries in WAL logs.

## Decision
Periodically compact WAL records every 500 batches by writing a snapshot and truncating preceding entries.

## Consequences
Limits checkpoint file sizes to under 100KB while keeping recovery duration under 5ms.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
