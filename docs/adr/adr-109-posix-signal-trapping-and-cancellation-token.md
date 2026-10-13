# ADR-109: Adopt Unified Cancellation Token Linked to POSIX Signal Traps

## Status
Accepted

## Context
Cancelling imports via Ctrl+C sometimes resulted in corrupted export files or hung network sockets.

## Decision
Introduce an AbortSignal-backed CancellationToken wired directly to process SIGINT and SIGTERM handlers.

## Consequences
Guarantees that pending database writes finish and partial files are safely renamed or flushed before process exit.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
