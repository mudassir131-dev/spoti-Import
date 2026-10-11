# ADR-053: Separated Standard Output and Standard Error Streams

## Status
Accepted

## Context
When CLI tools export structured data (JSON, CSV) directly to the console or stdout, diagnostic messages must not corrupt the data stream.

## Decision
Strictly separate stream outputs:
- All generated structured export data and primary command output goes to `stdout`.
- All progress updates, diagnostic messages, warnings, and errors go to `stderr`.

## Consequences
- Supports clean UNIX piping (e.g., `music-import import ... | jq .`).
- Zero data corruption in redirected stdout streams.
