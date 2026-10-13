# ADR-107: Adopt Adaptive Batch Sizing Algorithm for High Memory Pressure Scenarios

## Status
Accepted

## Context
Fixed batch sizes caused excessive memory spikes when importing tracks with unusually large artist and image metadata payloads.

## Decision
Dynamically scale batch sizes between 25 and 100 tracks based on real-time process heap usage metrics.

## Consequences
Prevents out-of-memory crashes on constrained client machines while maintaining peak throughput on machines with abundant RAM.
- Comprehensive test coverage and type-safety maintained across all adapters.
- Fully aligned with Universal Music Import Engine v1/v2 architectural objectives.
