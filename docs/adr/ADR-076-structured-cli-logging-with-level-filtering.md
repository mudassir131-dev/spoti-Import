# ADR-076: Structured CLI Logging with Level Filtering

## Status
Accepted

## Context
Command-line operators require granular control over output diagnostics during high-volume playlist ingestion, ranging from debug tracing to quiet minimal output for shell pipelines.

## Decision
Implement structured log level thresholds (`debug`, `info`, `warn`, `error`) configurable via `--log-level` and `--quiet` flags, writing diagnostics exclusively to stderr to protect stdout piping integrity.

## Consequences
- Operators can isolate debug traces without contaminating JSON/CSV stdout streams.
- Clean automated log aggregation in CI/CD environments.
