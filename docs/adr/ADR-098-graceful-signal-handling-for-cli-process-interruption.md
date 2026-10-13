# ADR-098: Graceful Signal Handling for CLI Process Interruption

## Status
Accepted

## Context
User interruption via Ctrl+C (SIGINT) or orchestrator termination (SIGTERM) must not corrupt checkpoints or leave dangling open handles.

## Decision
Attach dedicated signal handlers that trigger `AbortController`, flush in-progress checkpoint writes, and cleanly release file locks before exit.

## Consequences
- Guarantees imports can be resumed from exact track index after interruption.
- Standard POSIX exit status code 130 emitted on signal termination.
