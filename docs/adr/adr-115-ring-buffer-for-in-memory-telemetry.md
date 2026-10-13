# ADR-115: Adopt Fixed-Size Ring Buffer for Telemetry Metrics Storage

## Status
Accepted

## Context
Tracking historical latency and throughput samples in growing arrays caused memory consumption to drift upward.

## Decision
Allocate a fixed-size 1,000-slot circular ring buffer for recent telemetry samples.

## Consequences
Ensures strictly constant memory consumption regardless of how long the import pipeline runs.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
