# ADR-089: Offline Mock Source Simulation Mode via CLI Flag

## Status
Accepted

## Context
Developers and CI test pipelines need to verify CLI flags and end-to-end downstream integrations without outbound internet connectivity or mock servers.

## Decision
Introduce a `--mock` flag that connects the engine to an embedded `InMemoryMusicSource` loaded with canonical test fixtures.

## Consequences
- Instant 100% offline integration testing of CLI pipelines.
- Zero credential requirements during local demonstrations and workshops.
