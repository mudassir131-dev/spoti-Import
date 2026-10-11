# ADR-051: CLI as Hexagonal Driving Adapter

## Status
Accepted

## Context
The Universal Music Import Engine requires an external command-line interface to allow standalone execution, script automation, and user workflows. In Hexagonal Architecture, transport mechanisms must reside entirely outside the core application boundary.

## Decision
Implement the CLI (`music-import`) as a pure primary (driving) adapter in `src/cli/`. The CLI translates CLI arguments and flags into port calls on the underlying domain services and ports (`MusicSource`, `MusicDestination`, `TrackNormalizer`).

## Consequences
- Core business logic remains 100% decoupling from terminal interfaces and process exit semantics.
- Standalone command-line invocation is fully isolated and interchangeable.
