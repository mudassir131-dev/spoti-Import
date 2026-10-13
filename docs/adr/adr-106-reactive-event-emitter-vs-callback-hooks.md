# ADR-106: Adopt Typed Event Emitter Over Callback Hooks for Lifecycle Monitoring

## Status
Accepted

## Context
The import engine required a flexible, low-overhead mechanism for broadcasting progress updates and state transitions to multiple consumers without tight coupling.

## Decision
Implement a strongly-typed EventEmitter interface supporting asynchronous listeners and bounded error isolation.

## Consequences
Clean separation of concerns, decoupling CLI terminal UI from engine core logic, with negligible overhead.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
