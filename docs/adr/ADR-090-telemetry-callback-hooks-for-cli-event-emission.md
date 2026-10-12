# ADR-090: Telemetry Callback Hooks for CLI Event Emission

## Status
Accepted

## Context
Enterprise integrations require observable lifecycle hooks to pipe import events into external logging systems (Datadog, Prometheus, OpenTelemetry).

## Decision
Provide an extensible `ImportEventListener` interface in core domain ports, exposing granular lifecycle events (`onBatchStart`, `onBatchComplete`, `onError`).

## Consequences
- Observability without coupling the core import engine to proprietary monitoring SDKs.
- Zero performance impact when no listeners are registered.
