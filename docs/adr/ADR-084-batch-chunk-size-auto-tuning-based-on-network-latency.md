# ADR-084: Batch Chunk Size Auto-Tuning Based on Network Latency

## Status
Accepted

## Context
Fixed batch sizes of 100 tracks may be sub-optimal over high-latency mobile hotspots or high-bandwidth gigabit connections.

## Decision
Support adaptive batch scaling between 50 and 500 tracks by monitoring rolling HTTP round-trip latencies, while preserving strict 10,000-track boundary invariants.

## Consequences
- Maximizes throughput under diverse networking profiles.
- Keeps memory consumption strictly within the 100MB runtime budget.
