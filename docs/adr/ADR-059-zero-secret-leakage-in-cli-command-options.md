# ADR-059: Zero Secret Leakage in CLI Command Options

## Status
Accepted

## Context
The CLI accepts Spotify API credentials (`--client-id`, `--client-secret`). These secrets must never be exposed in log messages, error traces, or terminal output.

## Decision
Pass credential flags directly into memory without logging, and scrub sensitive keys from all error reporting pipelines.

## Consequences
- Strict compliance with security and privacy requirements.
- Safe execution in shared multi-user terminal environments and CI logs.
