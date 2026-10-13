# ADR-105: Pluggable Storage Adapter Boundary for Android SQLite

## Status
Accepted

## Context
The universal engine will be integrated with Android client applications via Room / SQLite persistence layer.

## Decision
Structure domain contracts to emit serializable interchange payloads that map directly to SQLite relational tables without adapter bloat.

## Consequences
- Clean interoperability with Android Room entities.
- Zero dependency on platform-specific native libraries inside the core engine.
