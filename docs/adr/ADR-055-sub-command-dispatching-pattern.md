# ADR-055: Sub-Command Dispatching Pattern

## Status
Accepted

## Context
The CLI provides multiple distinct capabilities: version display, playlist ingestion, file validation, and metadata inspection.

## Decision
Implement a modular `CliRunner` registry where each command implements the `CliCommand` interface and is registered independently.

## Consequences
- Clean separation of concerns between individual command implementations.
- Straightforward extensibility for future CLI commands.
