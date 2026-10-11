# ADR-058: Process SIGINT and AbortSignal Handling

## Status
Accepted

## Context
Users may interrupt long-running import tasks using Ctrl+C (SIGINT). Aborting midway without graceful cleanup can lead to corrupted output files.

## Decision
Attach SIGINT signal listeners in `bin.ts` that notify an internal `AbortController`, which triggers transactional rollback and exits cleanly with POSIX code 130.

## Consequences
- Safe rollback of partial batches upon cancellation.
- Clean process shutdown respecting standard POSIX signal conventions.
