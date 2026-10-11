# ADR-072: CLI Process Memory Budget Enforcement

## Status
Accepted

## Context
The CLI must operate within constrained execution environments, such as low-resource containers or AWS Lambda functions.

## Decision
Leverage generator streams and chunk sinks so that memory usage never scales linearly with playlist track count.

## Consequences
- Stable memory consumption under 64MB even when processing 10,000 tracks.
- High resilience and minimal garbage collection pauses.
