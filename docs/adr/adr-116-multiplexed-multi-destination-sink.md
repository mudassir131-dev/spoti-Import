# ADR-116: Adopt Multiplexed Broadcaster Sink for Dual JSON and CSV Exports

## Status
Accepted

## Context
Users required simultaneous export to both JSON for Android sync and CSV for spreadsheet analysis.

## Decision
Introduce a composite MusicDestination adapter that broadcasts track batches across multiple registered sinks.

## Consequences
Eliminates redundant source fetch queries and generates multiple export formats in a single pass.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
